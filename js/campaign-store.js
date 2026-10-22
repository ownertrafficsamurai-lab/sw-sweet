// Кампании в Supabase (4.1, спека 2026-10-10-campaigns-join.md): функции базы my_campaigns,
// find_campaign, join_campaign, campaign_roster, regenerate_invite, trash_campaign, restore_campaign
// и таблицы campaigns / campaign_characters. Каждая функция возвращает объект-исход и не бросает:
// { ok: true, … } либо { error: вид }, где вид — not_found | too_many_attempts | not_owner |
// already_in_campaign | campaign_full | limit | name | forbidden | gone | network (нет сети, таймаут,
// всё неожиданное). gone — строки уже нет (переименовать, исключить, удалить навсегда).
// Листы группы для дашборда мастера (4.2) — без условия по владельцу: какие строки видны, решает
// RLS (мастер — персонажи своей активной кампании). Этап 5: листы — функцией party_sheets (без
// портрета, с его отпечатком), портреты — отдельным запросом (party-sheets.js решает, чьи)
// Пул Судьбы стола (этап 5, часть 2): destiny_pool, spend_destiny, undo_destiny, set_destiny и закрытый
// канал destiny:<id кампании>; пул в ответах — как его отдаёт база (destiny-model.js readPool проверяет)
// Клиент supabase берётся при первом запросе (getClient): так модуль импортируется тестами в Node,
// где supabase-client.js с адресом CDN не загрузить.
const TIMEOUT_MS = 20000;
const KINDS = ['not_found', 'too_many_attempts', 'not_owner', 'already_in_campaign', 'campaign_full', 'forbidden'];

export function errorKind(error) {
    const text = `${error?.message ?? ''} ${error?.details ?? ''}`;
    if (text.includes('campaigns_limit')) return 'limit';
    if (text.includes('campaigns_name_length')) return 'name';
    return KINDS.find(kind => text.includes(kind)) ?? 'network';
}

export function makeCampaignStore(getClient, { timeoutMs = TIMEOUT_MS } = {}) {
    // Каналы watchTopic, которые ещё уходят: тема → промис ухода
    const leaving = new Map();
    // У запросов supabase-js нет своего таймаута (как в character-store.js)
    async function call(build) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const { data, error } = await build(await getClient()).abortSignal(controller.signal);
            return error ? { error: errorKind(error) } : { ok: true, data };
        } catch {
            return { error: 'network' };
        } finally {
            clearTimeout(timer);
        }
    }
    // Закрытый канал Realtime topic: onPayload(payload) — на каждое сообщение event; status('live' |
    // 'lost' | 'closed') — канал подключён (и после каждого переподключения) / ошибка или таймаут
    // (realtime-js переподключается сам) / закрыт не нами или не создался: сам он не вернётся.
    // → stop(): отписаться; после него обратных вызовов нет
    function watchTopic(topic, event, onPayload, status) {
        let stopped = false;
        let client = null;
        let channel = null;
        (async () => {
            try {
                client = await getClient();
                // Прежний канал той же темы ещё уходит — realtime-js отдал бы его же, а subscribe
                // на уходящем ничего не делает
                await leaving.get(topic);
                if (stopped) return;
                await client.realtime.setAuth();
                if (stopped) return;
                channel = client.channel(topic, { config: { private: true } })
                    .on('broadcast', { event }, (message) => { if (!stopped) onPayload(message?.payload); })
                    .subscribe((state) => {
                        if (!stopped) status(state === 'SUBSCRIBED' ? 'live' : state === 'CLOSED' ? 'closed' : 'lost');
                    });
            } catch {
                if (!stopped) status('closed');
            }
        })();
        return () => {
            stopped = true;
            if (!channel) return;
            const gone = client.removeChannel(channel).catch(() => {});
            leaving.set(topic, gone);
            gone.then(() => { if (leaving.get(topic) === gone) leaving.delete(topic); });
        };
    }
    // Исход действия с пулом: пул в ответе | ожидаемая неудача { error: 'empty' } в данных
    function poolOutcome(result) {
        if (!result.ok) return result;
        if (result.data?.error === 'empty') return { error: 'empty' };
        if (!result.data?.pool) return { error: 'network' };
        const outcome = { ok: true, pool: result.data.pool };
        if (result.data.action !== undefined) outcome.action = result.data.action;
        return outcome;
    }
    // find_campaign / join_campaign отвечают ожидаемой неудачей в данных: { error: … }
    const kindOf = value => (KINDS.includes(value) ? value : 'network');
    const rows = result => (result.ok ? { ok: true, rows: result.data ?? [] } : result);
    const touched = result => (!result.ok ? result : result.data?.length ? { ok: true } : { error: 'gone' });

    return {
        // Экран «Кампании»: строки my_campaigns
        listCampaigns: async () => rows(await call(c => c.rpc('my_campaigns'))),
        // → { ok, campaign: { id, name, gm_name, members } }
        async findCampaign(code) {
            const result = await call(c => c.rpc('find_campaign', { p_code: code }));
            if (!result.ok) return result;
            if (result.data?.error) return { error: kindOf(result.data.error) };
            return result.data?.campaign ? { ok: true, campaign: result.data.campaign } : { error: 'network' };
        },
        // → { ok, campaignId } | { error, campaignName? } — campaignName у already_in_campaign
        async joinCampaign(code, characterId) {
            const result = await call(c => c.rpc('join_campaign', { p_code: code, p_character_id: characterId }));
            if (!result.ok) return result;
            if (result.data?.error) {
                const failed = { error: kindOf(result.data.error) };
                if (result.data.campaign_name) failed.campaignName = result.data.campaign_name;
                return failed;
            }
            return result.data?.campaign_id ? { ok: true, campaignId: result.data.campaign_id } : { error: 'network' };
        },
        roster: async campaignId => rows(await call(c => c.rpc('campaign_roster', { p_campaign_id: campaignId }))),
        // Мастер — вошедший пользователь (триггер базы); → { ok, id }
        async createCampaign(name) {
            const result = await call(c => c.from('campaigns').insert({ name }).select('id').single());
            return result.ok ? { ok: true, id: result.data.id } : result;
        },
        renameCampaign: async (id, name) => touched(await call(c => c.from('campaigns').update({ name }).eq('id', id).select('id'))),
        // → { ok, code }
        async regenerateInvite(id) {
            const result = await call(c => c.rpc('regenerate_invite', { p_campaign_id: id }));
            return result.ok ? { ok: true, code: result.data } : result;
        },
        // → { ok, purgeAt } — до какого дня можно восстановить
        async trashCampaign(id) {
            const result = await call(c => c.rpc('trash_campaign', { p_campaign_id: id }));
            return result.ok ? { ok: true, purgeAt: result.data } : result;
        },
        async restoreCampaign(id) {
            const result = await call(c => c.rpc('restore_campaign', { p_campaign_id: id }));
            return result.ok ? { ok: true } : result;
        },
        // «Удалить навсегда» — только из корзины
        purgeCampaign: async id => touched(await call(c => c.from('campaigns').delete().eq('id', id).not('deleted_at', 'is', null).select('id'))),
        // «Выйти» (свои персонажи) и «Исключить» (мастер)
        removeFromCampaign: async (campaignId, characterIds) => touched(await call(c => c.from('campaign_characters')
            .delete().eq('campaign_id', campaignId).in('character_id', characterIds).select('character_id'))),
        // Карточки дашборда: → { ok, rows: [{ id, data, version, avatar_key }] } — data без charAvatar;
        // пустая группа — без запроса
        async partySheets(ids) {
            if (!ids.length) return { ok: true, rows: [] };
            return rows(await call(c => c.rpc('party_sheets', { p_ids: ids })));
        },
        // Портреты: → { ok, rows: [{ id, avatar }] } — avatar null, если портрета уже нет
        async partyAvatars(ids) {
            if (!ids.length) return { ok: true, rows: [] };
            return rows(await call(c => c.from('characters').select('id, avatar:data->>charAvatar').in('id', ids)));
        },
        // Живые обновления дашборда (этап 5): закрытый канал Realtime `party:<id кампании>`. sheet(id)
        // — после записи персонажа группы (сообщение `sheet` от триггера базы, в нём только
        // { character, version }); status — как у watchTopic. Слушать канал база разрешает только
        // мастеру активной кампании. → stop()
        watchParty(campaignId, { sheet, status }) {
            return watchTopic(`party:${campaignId}`, 'sheet', (payload) => {
                if (typeof payload?.character === 'string') sheet(payload.character);
            }, status);
        },
        // Пул Судьбы (этап 5, часть 2): → { ok, pool, role: 'gm' | 'player', campaign — название } |
        // { error: forbidden | network }
        async destinyPool(campaignId) {
            const result = await call(c => c.rpc('destiny_pool', { p_campaign_id: campaignId }));
            if (!result.ok) return result;
            const role = result.data?.role;
            if (!result.data?.pool || (role !== 'gm' && role !== 'player')) return { error: 'network' };
            return { ok: true, pool: result.data.pool, role, campaign: String(result.data.campaign ?? '') };
        },
        // Потратить жетон: 'light' — игрок своим персонажем characterId, 'dark' — мастер.
        // → { ok, pool, action } (action — номер для «Отменить») | { error: empty | forbidden | network }
        spendDestiny: async (campaignId, side, characterId = null) => poolOutcome(await call(c => c.rpc('spend_destiny',
            { p_campaign_id: campaignId, p_side: side, p_character_id: characterId }))),
        // «Отменить» свою трату action → { ok, pool } | { error: empty | forbidden | network }
        undoDestiny: async (campaignId, action) => poolOutcome(await call(c => c.rpc('undo_destiny', { p_campaign_id: campaignId, p_action: action }))),
        // «Задать пул» (мастер) → { ok, pool } | { error: forbidden | network }
        setDestiny: async (campaignId, light, dark) => poolOutcome(await call(c => c.rpc('set_destiny',
            { p_campaign_id: campaignId, p_light: light, p_dark: dark }))),
        // Закрытый канал `destiny:<id кампании>`: pool(raw) — пул после любого действия (сообщение
        // `pool` от функций базы); слушать могут мастер и игроки активной кампании. → stop()
        watchDestiny(campaignId, { pool, status }) {
            return watchTopic(`destiny:${campaignId}`, 'pool', (payload) => { if (payload) pool(payload); }, status);
        },
        // Просмотр листа и ‹ ›: → { ok, data } | { missing: true } — строки не видно (исключён,
        // удалён, кампания в корзине) | { error }
        async loadSheet(id) {
            const result = await call(c => c.from('characters').select('data').eq('id', id).maybeSingle());
            if (!result.ok) return result;
            return result.data ? { ok: true, data: result.data.data } : { missing: true };
        },
    };
}

let client = null;
const supabaseClient = async () => (client ??= (await import('./supabase-client.js')).supabase);
const store = makeCampaignStore(supabaseClient);

export const listCampaigns = store.listCampaigns;
export const findCampaign = store.findCampaign;
export const joinCampaign = store.joinCampaign;
export const roster = store.roster;
export const createCampaign = store.createCampaign;
export const renameCampaign = store.renameCampaign;
export const regenerateInvite = store.regenerateInvite;
export const trashCampaign = store.trashCampaign;
export const restoreCampaign = store.restoreCampaign;
export const purgeCampaign = store.purgeCampaign;
export const removeFromCampaign = store.removeFromCampaign;
export const partySheets = store.partySheets;
export const partyAvatars = store.partyAvatars;
export const loadSheet = store.loadSheet;
export const watchParty = store.watchParty;
export const destinyPool = store.destinyPool;
export const spendDestiny = store.spendDestiny;
export const undoDestiny = store.undoDestiny;
export const setDestiny = store.setDestiny;
export const watchDestiny = store.watchDestiny;
