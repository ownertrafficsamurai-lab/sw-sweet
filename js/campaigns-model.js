// Чистая часть экрана «Кампании» и окна вступления (4.1, спека 2026-10-10-campaigns-join.md). Без
// document, сети и хранилища — тестируется в Node.
// Строка кампании — ответ функции базы my_campaigns: { id, name, role: 'gm' | 'player', deleted_at,
// purge_at, gm_name, members, my_characters: [{ id, name }], code }. Строка группы — campaign_roster:
// { character_id, name, race_id, career_id, spec_id, player_name, is_mine }. Строка персонажа — из
// окна «Персонажи» (character-store.js listCharacters, с полем campaign — campaignOf).
import { displayName, initials, subtitle, sortRows, CHARACTER_LIMIT, campaignOf } from './character-list-model.js';

// Те же границы держит база (миграция 20261011120000_campaigns_join.sql)
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const CAMPAIGN_LIMIT = 10;
export const MEMBER_LIMIT = 12;
export const NAME_MAX = 60;
// Строка «Новый персонаж · создать и вступить» в окне вступления
export const NEW_CHARACTER = 'new';

const CODE_SHAPE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

// Как набрал игрок → как хранит база: верхний регистр, без дефисов и пробелов
export function normalizeCode(text) {
    return String(text ?? '').toUpperCase().replace(/[\s-]+/g, '');
}

export function isCodeShape(code) {
    return typeof code === 'string' && CODE_SHAPE.test(code);
}

// K7M2QX → K7M-2QX
export function formatCode(code) {
    return isCodeShape(code) ? `${code.slice(0, 3)}-${code.slice(3)}` : String(code ?? '');
}

// Название кампании: пробелы по краям не считаются, 1–60 знаков
export function cleanName(text) {
    return String(text ?? '').trim();
}

export function isNameValid(text) {
    const name = cleanName(text);
    return name.length >= 1 && [...name].length <= NAME_MAX;
}

// 1 персонаж, 2 персонажа, 5 персонажей
export function plural(n, [one, few, many]) {
    const tens = n % 100;
    const ones = n % 10;
    if (tens >= 11 && tens <= 14) return many;
    if (ones === 1) return one;
    if (ones >= 2 && ones <= 4) return few;
    return many;
}

export function charactersCount(n) {
    return `${n} ${plural(n, ['персонаж', 'персонажа', 'персонажей'])}`;
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const DAY_MS = 24 * 60 * 60 * 1000;

// «10 ноября» — до какого дня кампанию можно восстановить (местное время)
export function dayMonth(iso) {
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// «11 окт.» — когда удалена
export function shortDate(iso) {
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// Строка корзины мастера: «удалена 11 окт. · осталось 29 дн.» (полных суток до очистки; перед «дн.» —
// неразрывный пробел)
export function trashMeta(row, now = Date.now()) {
    const left = Math.floor((Date.parse(row.purge_at) - now) / DAY_MS);
    return `удалена ${shortDate(row.deleted_at)} · ${left > 0 ? `осталось ${left}\u00a0дн.` : 'осталось меньше суток'}`;
}

// Игрок видит кампанию, которую мастер удалил, вместо группы
export function trashedNotice(row) {
    return `Кампания удалена мастером. Её можно восстановить до ${dayMonth(row.purge_at)}`;
}

// Экран: в переключателе сначала кампании, которые я веду (активные), потом те, где играют мои
// персонажи (и удалённые мастером — игрок видит срок). Корзина мастера — отдельно, внизу.
// selectedId — выбранная раньше; её нет — первая
export function screenView(rows, selectedId) {
    const led = rows.filter(r => r.role === 'gm' && !r.deleted_at);
    const played = rows.filter(r => r.role === 'player');
    const tabs = [...led, ...played];
    return {
        tabs,
        current: tabs.find(r => r.id === selectedId) ?? tabs[0] ?? null,
        trash: rows.filter(r => r.role === 'gm' && r.deleted_at),
        showSwitcher: tabs.length > 1,
        empty: tabs.length === 0,
        atLimit: led.length >= CAMPAIGN_LIMIT,
    };
}

const myNames = row => (row.my_characters ?? []).map(c => displayName(c.name));

// Строка под названием: «мастер Алекс · играет ваш Кейл Ррен» / «вы мастер · 3 персонажа»
export function campaignSubline(row) {
    const names = myNames(row);
    const plays = names.length === 0 ? null
        : names.length === 1 ? `играет ваш ${names[0]}` : `играют ваши ${names.join(', ')}`;
    const head = row.role === 'gm' ? ['вы мастер', charactersCount(row.members ?? 0)] : [`мастер ${row.gm_name || 'без имени'}`];
    return [...head, plays].filter(Boolean).join(' · ');
}

// «Раса · Специализация»; чего нет в справочнике — пропускается
function raceAndSpec(row, db) {
    const race = db.races.find(r => r.id === row.race_id)?.name;
    const spec = db.careers.find(c => c.id === row.career_id)?.specializations.find(s => s.id === row.spec_id)?.name;
    return [race, spec].filter(Boolean);
}

// Строки группы: свой — «вы», чужой — имя игрока
export function rosterView(rows, db) {
    return rows.map(row => ({
        id: row.character_id,
        name: displayName(row.name),
        initials: initials(row.name),
        sub: [row.is_mine ? 'вы' : (row.player_name || 'игрок'), ...raceAndSpec(row, db)].join(' · '),
        mine: !!row.is_mine,
    }));
}

// «Кем играть»: свои персонажи; персонаж в другой активной кампании недоступен с подписью
// «уже в «…»». Открытый выбран заранее, если доступен; иначе первый доступный; иначе — «Новый
// персонаж» (если не достигнут предел 20). now — для кампаний в корзине старше 30 дней
export function pickView(rows, db, targetId, currentId, now = Date.now()) {
    const items = sortRows(rows).map((row) => {
        const campaign = campaignOf(row, now);
        const busy = campaign?.active ? (campaign.id === targetId ? 'уже в этой кампании' : `уже в «${campaign.name}»`) : null;
        return { id: row.id, name: displayName(row.name), initials: initials(row.name), sub: busy ?? subtitle(row, db), disabled: !!busy };
    });
    const canCreate = rows.length < CHARACTER_LIMIT;
    const free = items.filter(i => !i.disabled);
    const selected = free.find(i => i.id === currentId)?.id ?? free[0]?.id ?? (canCreate ? NEW_CHARACTER : null);
    return { items, canCreate, selected };
}

// Карточка найденной кампании в окне вступления
export function foundSubline(campaign) {
    const n = campaign.members ?? 0;
    const group = n === 0 ? 'в группе пока никого' : `в группе ${charactersCount(n)}`;
    return `мастер ${campaign.gm_name || 'без имени'} · ${group}`;
}

export function joinedText(characterName, campaignName) {
    return `✓ ${displayName(characterName)} вступил в «${campaignName}». Мастер видит его лист.`;
}

// Тексты ошибок (спека, раздел «Ошибки»). ctx: { character, campaign } — для already_in_campaign
export function errorText(kind, ctx = {}) {
    switch (kind) {
        case 'not_found': return 'Кампания с таким кодом не найдена';
        case 'too_many_attempts': return 'Слишком много попыток. Попробуйте через 15 минут';
        case 'already_in_campaign':
            return ctx.campaign
                ? `${displayName(ctx.character)} уже в «${ctx.campaign}». Сначала выйдите там`
                : `${displayName(ctx.character)} уже в другой кампании. Сначала выйдите там`;
        case 'campaign_full': return `В кампании уже ${MEMBER_LIMIT} персонажей — это предел`;
        case 'limit': return `Не больше ${CAMPAIGN_LIMIT} кампаний на аккаунт`;
        case 'not_owner': return 'Этого персонажа уже нет — возможно, он удалён на другом устройстве.';
        case 'name': return `Название — от 1 до ${NAME_MAX} знаков`;
        case 'forbidden':
        case 'gone': return 'Кампания больше недоступна';
        default: return 'Нет связи — попробуйте ещё раз';
    }
}

// Подтверждения (спека, раздел «Подтверждения»): { message, note, confirm }
export const confirmText = {
    trash: (name, purgeAt) => ({
        message: `Удалить кампанию «${name}»?`,
        note: `Она пролежит в «Удалённых» 30 дней — до ${dayMonth(purgeAt)} её можно восстановить. Пока она там, код не работает и вы не видите листы игроков. Персонажи останутся у игроков со всем опытом и снаряжением.`,
        confirm: 'Удалить',
    }),
    purge: name => ({
        message: `Удалить «${name}» навсегда?`,
        note: 'Название, код и состав группы пропадут без возможности восстановления. Персонажи останутся у игроков.',
        confirm: 'Удалить навсегда',
    }),
    leave: (characters, campaign) => ({
        message: `Выйти из кампании «${campaign}»?`,
        note: `${characters.map(displayName).join(', ')} — больше не в группе, мастер перестанет видеть лист. Вернуться можно по коду.`,
        confirm: 'Выйти',
    }),
    kick: (character, campaign) => ({
        message: `Исключить ${displayName(character)} из «${campaign}»?`,
        note: 'Персонаж останется у игрока. Вернуться он сможет по коду — чтобы этого не было, смените код.',
        confirm: 'Исключить',
    }),
    regenerate: () => ({
        message: 'Сменить код приглашения?',
        note: 'Старый код и ссылка перестанут работать. Уже вступившие останутся.',
        confirm: 'Сменить код',
    }),
};

// Ссылка-приглашение: адрес приложения без прежних параметров и с ?join=КОД
export function inviteLink(origin, pathname, code) {
    return `${origin}${pathname}?join=${code}`;
}
