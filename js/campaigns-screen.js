import { state } from './state.js';
import { CATALOG } from './reference-data.js';
import { openSheet, closeSheet, isSheetOpen } from './bottom-sheet.js';
import { showAlert, showDialog, showToast } from './ui-utils.js';
import { isOffline } from './net-status.js';
import {
    listCampaigns, roster as loadRoster, createCampaign, renameCampaign, regenerateInvite,
    trashCampaign, restoreCampaign, purgeCampaign, removeFromCampaign, partySheets, partyAvatars, watchParty,
} from './campaign-store.js';
import { makePortraits, newerSheets } from './party-sheets.js';
import { makePartyFeed } from './party-live.js';
import { attachPull } from './pull-refresh.js';
import {
    screenView, campaignSubline, rosterView, trashMeta, trashedNotice, formatCode, errorText,
    confirmText, inviteLink, isNameValid, cleanName,
} from './campaigns-model.js';
import { partyCards, critHint, liveLabel, changedCards, suppliesText } from './party-model.js';
import { iconElement } from './item-icons.js';
import { openView } from './party-view.js';
import { currentCharacterId, openCharacter, noteCampaigns } from './character-session.js';
import { saveReference } from './persistence.js';
import { openJoinDialog } from './join-dialog.js';
import { destinyRowElement, setDestinyScreen } from './destiny-pool.js';

// Экран «Кампании» (4.1, спека 2026-10-10-campaigns-join.md, макет campaign-place.html — вариант C).
// Пункт «⚑ Кампании» меню ☰ открывает его на весь экран поверх листа; закрывается «×» и Esc.
// Игрок видит свою кампанию и группу и может выйти; мастер — дашборд группы (4.2, спека
// 2026-10-14-gm-dashboard.md, макет dashboard-layout.html — вариант A): карточки персонажей с
// ранами, усталостью, поглощением, защитой и «✚ N» (подсказка с текстами ранений), нажатие на
// карточку — лист только для чтения (party-view.js); под карточками свёрнутое «Приглашение» (код,
// «Копировать ссылку», «Сменить код», состав группы с «Исключить»), «Удалить кампанию» и внизу
// раздел «Удалённые» (корзина на 30 дней). Переключатель сверху — если кампаний больше одной.
// Данные загружаются при каждом открытии. Дашборд мастера живой (этап 5, спека
// 2026-10-20-live-party-dashboard.md): пока он показан, правки листов группы приходят сами (канал
// Realtime, party-live.js решает, что дочитать), изменившаяся карточка вспыхивает, отметка
// «Актуально» / «нет связи · с ЧЧ:ММ» обновляет группу по нажатию. Без сети при открытии —
// «Нужна сеть»; сеть пропала при открытом экране — данные видны, действия приглушает net-status.js.
// Тексты из базы и листов игроков — только textContent.
const byId = id => document.getElementById(id);
const DAY_MS = 24 * 60 * 60 * 1000;
const TEXT = {
    loading: 'Загрузка…',
    failed: 'Не удалось загрузить кампании. Проверьте подключение к интернету.',
    offline: 'Нужна сеть',
    offlineNote: 'Кампании хранятся на сервере. Подключитесь к интернету — экран обновится сам.',
    empty: 'Ваши персонажи пока не в кампании.',
    emptyNote: 'Попросите у мастера код или ссылку.',
    rosterLoading: 'Загрузка группы…',
    rosterFailed: 'Не удалось загрузить группу.',
    rosterEmpty: 'В группе пока никого. Отправьте игрокам код или ссылку.',
    copied: 'Ссылка скопирована',
    copyBy: 'Скопируйте ссылку',
    unreadable: 'Лист не читается',
    opening: 'Загрузка…',
    out: 'без сознания',
    invite: 'Приглашение',
    members: 'Состав группы',
};
// Значки карточки — те же контуры, что у ран и усталости в карточке листа (index.html)
// Вспышка изменившейся карточки, мс (style.css, .party-flash); повтор неудачной догрузки, мс
const FLASH_MS = 1000;
const RETRY_MS = 5000;
const ICONS = {
    w: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
    s: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
};

let open = false;
let status = 'idle';        // 'loading' | 'failed' | 'offline' | 'ready'
let rows = [];              // строки my_campaigns
let selectedId = null;      // выбранная кампания переключателя
let flash = null;           // «✓ … вступил в …» над кампанией
// id кампании → { status: 'loading' | 'failed' | 'ready', rows }; у ведомой мастером ещё cards
// (party-model.js partyCards), sheets (Map id → лист с версией), at — когда пришли последние данные,
// stale — последняя догрузка не удалась, busy / again — идёт загрузка группы / нужна ещё одна,
// flashes (Map id карточки → когда вспыхнула)
const rosters = new Map();
// Подписка дашборда: { campaignId, feed (party-live.js), stop } — только пока дашборд показан
let watch = null;
let retryTimer = null;
// Дашборд, запомненный при уходе в просмотр листа игрока: { campaignId, entry } — по «← Группа»
// прежние карточки видны сразу, а изменившиеся за это время вспыхивают
let memory = null;
let inviteOpen = null;      // «Приглашение» раскрыто; null — как по умолчанию (раскрыто у пустой группы)
let hintFor = null;         // карточка с открытой подсказкой «✚»
let opening = null;         // карточка, лист которой загружается
let autoReloaded = false;   // после forbidden группы экран перезагружается сам не больше раза за открытие
let busy = false;           // идёт действие — кнопки неактивны
let returnFocus = null;
let nameSave = null;        // что делает «Создать» / «Сохранить» окна «Название»
let wired = false;

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function button(text, className, onClick) {
    const node = el('button', className, text);
    node.type = 'button';
    node.disabled = busy;
    node.addEventListener('click', onClick);
    return node;
}

// Действие экрана: одно за раз; кнопки неактивны, пока оно идёт
async function run(action) {
    if (busy) return;
    busy = true;
    render();
    try { await action(); } finally { busy = false; render(); }
}

// Исход действия не ok: кампании уже нет / нет доступа — сообщение и свежие данные; иначе сообщение
function failed(result) {
    showAlert(errorText(result.error));
    if (result.error === 'forbidden' || result.error === 'gone') reload();
}

function reload() {
    rosters.clear();
    return load();
}

function confirmThen(text, action, { danger = true } = {}) {
    showDialog({ ...text, cancel: 'Отмена', danger, onConfirm: () => run(action) });
}

// ── Окно «Название» (создать / переименовать) ──

function setNameError(text) {
    byId('campaign-name-error').textContent = text ?? '';
    byId('campaign-name-error').classList.toggle('hidden', !text);
}

function refreshNameSave(blocked = false) {
    byId('campaign-name-save').disabled = busy || blocked || !isNameValid(byId('campaign-name-input').value);
}

function openNameSheet({ title, value, confirm, blocked = false, onSave }) {
    byId('campaign-name-title').textContent = title;
    byId('campaign-name-save').textContent = confirm;
    byId('campaign-name-input').value = value;
    nameSave = blocked ? null : onSave;
    setNameError(blocked ? errorText('limit') : '');
    refreshNameSave(blocked);
    openSheet('campaign-name-sheet');
    byId('campaign-name-input').focus();
}

async function saveName() {
    if (busy || !nameSave || !isNameValid(byId('campaign-name-input').value)) return;
    const action = nameSave;
    busy = true;
    refreshNameSave();
    const result = await action(cleanName(byId('campaign-name-input').value));
    busy = false;
    refreshNameSave();
    if (result.ok) { closeSheet(); return; }
    if (result.error === 'forbidden' || result.error === 'gone') { closeSheet(); failed(result); return; }
    setNameError(errorText(result.error));
}

function createFlow(atLimit) {
    openNameSheet({
        title: 'Новая кампания', value: '', confirm: 'Создать', blocked: atLimit,
        onSave: async (name) => {
            const result = await createCampaign(name);
            if (result.ok) { selectedId = result.id; flash = null; reload(); }
            return result;
        },
    });
}

function renameFlow(campaign) {
    openNameSheet({
        title: 'Переименовать кампанию', value: campaign.name, confirm: 'Сохранить',
        onSave: async (name) => {
            const result = await renameCampaign(campaign.id, name);
            if (result.ok) { campaign.name = name; render(); }
            return result;
        },
    });
}

// ── Действия ──

async function copyLink(campaign) {
    const link = inviteLink(location.origin, location.pathname, campaign.code);
    try {
        await navigator.clipboard.writeText(link);
        showToast(TEXT.copied, 'success');
    } catch {
        // Нет доступа к буферу обмена (старый браузер, запрет) — ссылка в сообщении
        showDialog({ message: TEXT.copyBy, note: link });
    }
}

function regenerate(campaign) {
    confirmThen(confirmText.regenerate(), async () => {
        const result = await regenerateInvite(campaign.id);
        if (!result.ok) { failed(result); return; }
        campaign.code = result.code;
    }, { danger: false });
}

function kick(campaign, member) {
    confirmThen(confirmText.kick(member.name, campaign.name), async () => {
        const result = await removeFromCampaign(campaign.id, [member.id]);
        // Персонажа уже нет в группе (ушёл сам) — просто свежие данные
        if (!result.ok && result.error !== 'gone') { failed(result); return; }
        await reload();
    });
}

function leave(campaign) {
    const mine = campaign.my_characters ?? [];
    confirmThen(confirmText.leave(mine.map(c => c.name), campaign.name), async () => {
        const result = await removeFromCampaign(campaign.id, mine.map(c => c.id));
        if (!result.ok && result.error !== 'gone') { failed(result); return; }
        selectedId = null;
        flash = null;
        await reload();
    });
}

function trash(campaign) {
    confirmThen(confirmText.trash(campaign.name, new Date(Date.now() + 30 * DAY_MS).toISOString()), async () => {
        const result = await trashCampaign(campaign.id);
        if (!result.ok) { failed(result); return; }
        selectedId = null;
        flash = null;
        await reload();
    });
}

function restore(campaign) {
    run(async () => {
        const result = await restoreCampaign(campaign.id);
        if (!result.ok) { failed(result); return; }
        selectedId = campaign.id;
        flash = null;
        await reload();
    });
}

function purge(campaign) {
    confirmThen(confirmText.purge(campaign.name), async () => {
        const result = await purgeCampaign(campaign.id);
        if (!result.ok && result.error !== 'gone') { failed(result); return; }
        await reload();
    });
}

function join() {
    openJoinDialog({ joined: (campaignId, text) => openCampaigns({ select: campaignId, flash: text }) });
}

// ── Дашборд мастера (4.2) ──

// Справочники для checkSave листов группы и формулы порогов (sheet-stats.js)
const partyReference = () => ({ ...saveReference(), catalog: CATALOG });
// Портреты группы — в памяти, пока открыта страница (этап 5): скачиваются, только когда изменились
const portraits = makePortraits();

// Листы группы для карточек: без портрета, портреты — только новые. → { ok, rows } | { error }.
// Портрет не скачался — карточка с прежним (или с инициалами), в следующий раз спросится снова
async function loadSheets(ids) {
    const lite = await partySheets(ids);
    if (!lite.ok) return lite;
    const need = portraits.missing(lite.rows);
    const fetched = need.length ? await partyAvatars(need) : { ok: true, rows: [] };
    portraits.store(lite.rows, fetched.ok ? fetched.rows : []);
    return { ok: true, rows: portraits.sheets(lite.rows) };
}

// Новые листы на карточки: изменившиеся (и новые) карточки вспыхивают, если карточки уже были
function showCards(entry, rosterRows, sheets) {
    const cards = partyCards(rosterRows, [...sheets.values()], partyReference());
    const now = Date.now();
    if (entry.cards) for (const id of changedCards(entry.cards, cards)) entry.flashes.set(id, now);
    Object.assign(entry, { status: 'ready', rows: rosterRows, sheets, cards, at: new Date(), stale: false });
    render();
}

// Догрузка не удалась при показанных карточках: «нет связи», через RETRY_MS — ещё раз (без сети —
// не пробуем: вернётся сеть — догрузит party-live.js)
function retryLater(campaignId) {
    if (retryTimer || isOffline()) return;
    retryTimer = setTimeout(() => {
        retryTimer = null;
        if (open && watch?.campaignId === campaignId && rosters.has(campaignId)) loadParty(campaignId);
    }, RETRY_MS);
}

// Дашборд мастера: состав и листы группы. Первая загрузка за открытие экрана (и «Повторить») —
// «Загрузка группы…»; дальше («Актуально», жест, догрузка) карточки остаются на экране. Одна
// загрузка за раз. Просьба во время загрузки: догрузка (queue) — ещё одна после неё (та могла
// прочитать лист до правки); нажатие и жест ничего не добавляют. → Promise — когда загрузка (и
// следующая за ней) кончилась
function loadParty(campaignId, { queue = true } = {}) {
    let entry = rosters.get(campaignId);
    if (!entry) {
        entry = memory?.campaignId === campaignId ? memory.entry : { status: 'loading', rows: [], sheets: new Map(), flashes: new Map() };
        rosters.set(campaignId, entry);
    }
    memory = null;
    if (entry.busy) {
        if (queue) entry.again = true;
        return entry.running;
    }
    entry.running = runParty(campaignId, entry);
    return entry.running;
}

async function runParty(campaignId, entry) {
    if (entry.status === 'failed') entry.status = 'loading';
    if (entry.status === 'ready' && isOffline()) { entry.stale = true; render(); return; }
    Object.assign(entry, { busy: true, again: false });
    render();
    const result = await loadRoster(campaignId);
    const sheets = result.ok && rosters.get(campaignId) === entry ? await loadSheets(result.rows.map(r => r.character_id)) : result;
    // Экран закрыт или загружен заново, пока шёл запрос
    if (!open || rosters.get(campaignId) !== entry) return;
    entry.busy = false;
    if (result.error === 'forbidden') { forbidden(campaignId, result); return; }
    if (!sheets.ok) {
        if (entry.status === 'ready') { entry.stale = true; retryLater(campaignId); } else entry.status = 'failed';
        render();
        return;
    }
    showCards(entry, result.rows, newerSheets(entry.sheets, sheets.rows, result.rows.map(r => r.character_id)));
    if (entry.again) await loadParty(campaignId);
}

// Жест «потянуть вниз» (pull-refresh.js): возможен, пока показан дашборд с карточками
function pullEnabled() {
    return open && watch !== null && rosters.get(watch.campaignId)?.status === 'ready';
}

function pullRefresh() {
    return watch ? refreshParty(watch.campaignId) : Promise.resolve();
}

// Сообщения канала: эти листы изменились. Чужие для группы id (состав вживую не отслеживается) —
// мимо; идёт загрузка группы — после неё ещё одна (она могла прочитать лист до правки)
async function liveSheets(campaignId, ids) {
    const entry = rosters.get(campaignId);
    if (!entry) return;
    if (entry.busy) { entry.again = true; return; }
    if (entry.status !== 'ready') return;
    const wanted = ids.filter(id => entry.rows.some(r => r.character_id === id));
    if (!wanted.length) return;
    const sheets = await loadSheets(wanted);
    if (!open || rosters.get(campaignId) !== entry) return;
    if (!sheets.ok) { entry.stale = true; retryLater(campaignId); render(); return; }
    showCards(entry, entry.rows, newerSheets(entry.sheets, sheets.rows));
}

// Подписка — ровно пока показан дашборд кампании, которую ведёт вошедший (вызывается из render).
// Пул Судьбы (этап 5, часть 2) — той же кампании: строка над карточками группы
function syncWatch() {
    const current = open && status === 'ready' ? screenView(rows, selectedId).current : null;
    const wanted = current?.role === 'gm' && !current.deleted_at ? current.id : null;
    if (open) setDestinyScreen(wanted);
    if (watch?.campaignId === wanted) return;
    stopWatch();
    if (!wanted) return;
    const feed = makePartyFeed({
        changed: ids => liveSheets(wanted, ids),
        resync: () => { if (rosters.has(wanted)) loadParty(wanted); },
        update: render,
        setTimer: setTimeout, clearTimer: clearTimeout,
    });
    // dead — канал закрыт не нами или не создался: сам не вернётся (reviveWatch)
    const entry = { campaignId: wanted, feed, dead: false, stop: null };
    watch = entry;
    entry.stop = watchParty(wanted, {
        sheet: feed.sheet,
        status: (state) => { if (state === 'closed') entry.dead = true; feed.channel(state); },
    });
    if (isOffline()) feed.network(false);
}

// Страница снова видна, сеть вернулась, нажатие на отметку или жест — мёртвый канал подписывается
// заново (его подключение догрузит группу). → true, если подписались заново
function reviveWatch() {
    if (!watch?.dead || isOffline()) return false;
    stopWatch();
    syncWatch();
    return true;
}

// «Актуально» / «нет связи» и жест: обновить группу; во время загрузки ничего не добавляет
function refreshParty(campaignId) {
    reviveWatch();
    return loadParty(campaignId, { queue: false });
}

function stopWatch() {
    if (watch) { watch.feed.stop(); watch.stop(); }
    watch = null;
    clearTimeout(retryTimer);
    retryTimer = null;
}

// Нажатие на карточку. Свой персонаж — свой лист как обычно (экран закрывается); чужой — лист только
// для чтения (party-view.js); лист не прошёл checkSave — сообщение
function openCard(campaign, entry, card) {
    if (card.mine) {
        run(async () => { if (card.id === currentCharacterId() || await openCharacter(card.id)) closeCampaigns(); });
        return;
    }
    if (!card.readable) { showAlert(TEXT.unreadable); return; }
    run(async () => {
        opening = card.id;
        render();
        let outcome;
        try { outcome = await openView(campaign.id, entry.cards, card.id); } finally { opening = null; }
        // Персонажа уже нет в кампании — сообщение показано, группа — заново
        if (outcome === 'missing') await reload();
    });
}

function focusCrit(id) {
    document.querySelector(`#campaigns-body [data-card="${CSS.escape(id)}"] .party-crit`)?.focus();
}

// Подсказка «✚»: одна за раз; повторное нажатие, нажатие мимо и Esc закрывают её
function toggleHint(id) {
    hintFor = hintFor === id ? null : id;
    render();
    focusCrit(id);
}

function closeHint() {
    const id = hintFor;
    hintFor = null;
    render();
    focusCrit(id);
}

function icon(path) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', path);
    svg.append(line);
    return svg;
}

// Раны или усталость: «число / порог» и полоса цветом vitalFill; без расы — «—»
function vitalElement(kind, value) {
    const box = el('span', `party-v party-v-${kind}`);
    const top = el('span', 'party-v-top');
    const number = el('b', 'party-v-val', value ? String(value.cur) : '—');
    if (value) number.append(el('small', null, `/${value.max}`));
    top.append(icon(ICONS[kind]), number);
    const bar = el('span', 'party-bar');
    const fill = el('i');
    if (value) { fill.style.width = value.pct + '%'; fill.style.background = value.color; }
    bar.append(fill);
    box.append(top, bar);
    return box;
}

function statElement(label, value) {
    const item = el('span', 'party-stat', label);
    item.append(el('b', null, value ?? '—'));
    return item;
}

// Строка запасов (этап 5, п. 1, макет party-consumables.html — A): рамка «иконка + число», свой без
// рисунка — начало названия; кончившееся лечение — красным. Видимое скрыто от читалки — ей подпись
// (кнопка карточки ссылается на неё aria-describedby: её aria-label заменяет содержимое)
function suppliesElement(card) {
    const row = el('span', 'party-sup');
    for (const s of card.supplies) {
        const chip = el('span', 'party-sup-chip' + (s.empty ? ' party-sup-out' : ''));
        chip.setAttribute('aria-hidden', 'true');
        chip.append(s.icon ? iconElement(s.icon) : el('span', 'party-sup-name', s.label), el('b', null, String(s.qty)));
        row.append(chip);
    }
    const text = el('span', 'sr-only', suppliesText(card.supplies));
    text.id = `party-sup-${card.id}`;
    row.append(text);
    return row;
}

function cardElement(campaign, entry, card) {
    const hot = card.hot === 'wounds' ? ' party-hot-w' : card.hot === 'strain' ? ' party-hot-s' : '';
    const box = el('div', 'party-card' + hot + (card.readable ? '' : ' party-dim'));
    box.dataset.card = card.id;
    // Вспышка (этап 5, п. 3): перерисовка посреди неё продолжает её с того же места
    const age = Date.now() - (entry.flashes?.get(card.id) ?? -Infinity);
    if (age < FLASH_MS) {
        box.classList.add('party-flash');
        box.style.setProperty('--flash-at', `-${age}ms`);
    } else {
        entry.flashes?.delete(card.id);
    }
    const main = button('', 'party-open', () => openCard(campaign, entry, card));
    main.setAttribute('aria-label', `Открыть лист: ${card.name}`);
    const avatar = card.avatar;
    const portrait = el('span', 'party-av', avatar ? '' : card.initials);
    if (avatar) portrait.style.backgroundImage = `url(${avatar})`;
    const names = el('span', 'party-nm');
    names.append(el('b', 'party-name', card.name), el('span', 'party-sub', card.sub));
    const who = el('span', 'party-id');
    who.append(portrait, names);
    main.append(who);
    if (opening === card.id || !card.readable) {
        main.append(el('span', 'party-note', opening === card.id ? TEXT.opening : TEXT.unreadable));
    } else {
        const vitals = el('span', 'party-vt');
        vitals.append(vitalElement('w', card.wounds), vitalElement('s', card.strain));
        main.append(vitals);
        if (card.supplies.length) {
            main.append(suppliesElement(card));
            main.setAttribute('aria-describedby', `party-sup-${card.id}`);
        }
        const foot = el('span', 'party-foot');
        foot.append(statElement('ПОГЛ', card.soak), statElement('ЗАЩ', card.defense));
        if (card.out) foot.append(el('span', 'party-out', TEXT.out));
        main.append(foot);
    }
    box.append(main);
    // «✚» — отдельная кнопка рядом с карточкой, не внутри неё
    if (card.readable && card.crits.length && opening !== card.id) {
        const crit = button(`✚ ${card.crits.length}`, 'party-crit', () => toggleHint(card.id));
        crit.setAttribute('aria-label', `Критические ранения: ${card.crits.length}`);
        crit.setAttribute('aria-expanded', String(hintFor === card.id));
        crit.setAttribute('aria-controls', 'party-hint');
        box.append(crit);
    }
    return box;
}

function hintElement(card) {
    const { title, lines, bonus } = critHint(card.crits);
    const hint = el('div', 'party-hint');
    hint.id = 'party-hint';
    hint.setAttribute('role', 'group');
    hint.setAttribute('aria-label', title);
    const list = el('ul', 'party-hint-list');
    list.append(...lines.map(line => el('li', null, line)));
    hint.append(el('b', 'party-hint-title', title), list, el('p', 'party-hint-bonus', bonus));
    return hint;
}

// Подсказка — над карточкой во всю ширину группы; не помещается под шапкой экрана — под карточкой
function placeHint() {
    const hint = document.querySelector('#campaigns-body .party-hint');
    const card = hint && document.querySelector(`#campaigns-body [data-card="${CSS.escape(hintFor)}"]`);
    if (!card) return;
    const gap = 6;
    const ceiling = document.querySelector('#campaigns-screen .camp-head').getBoundingClientRect().bottom;
    const above = card.getBoundingClientRect().top - hint.offsetHeight - gap >= ceiling;
    hint.style.top = (above ? card.offsetTop - hint.offsetHeight - gap : card.offsetTop + card.offsetHeight + gap) + 'px';
    hint.classList.toggle('party-hint-below', !above);
}

function partyElements(campaign) {
    const entry = rosters.get(campaign.id);
    if (!entry || entry.status === 'loading') return [el('p', 'camp-empty', TEXT.rosterLoading)];
    if (entry.status === 'failed') return [el('p', 'camp-empty', TEXT.rosterFailed), button('Повторить', 'charlist-btn', () => loadParty(campaign.id, { queue: false }))];
    if (!entry.cards.length) return [el('p', 'camp-empty', TEXT.rosterEmpty)];
    const grid = el('div', 'party-grid');
    grid.append(...entry.cards.map(card => cardElement(campaign, entry, card)));
    const hinted = entry.cards.find(card => card.id === hintFor);
    if (hinted) grid.append(hintElement(hinted));
    return [grid];
}

// «Приглашение · K7M-2QX ▸»: раскрывает «Копировать ссылку», «Сменить код» и состав группы с
// «Исключить»; у пустой группы раскрыто сразу
function inviteElements(campaign) {
    const entry = rosters.get(campaign.id);
    const ready = entry?.status === 'ready';
    const expanded = inviteOpen ?? (ready && entry.rows.length === 0);
    const fold = button('', 'camp-fold', () => { inviteOpen = !expanded; render(); });
    fold.setAttribute('aria-expanded', String(expanded));
    fold.append(el('span', 'camp-fold-label', TEXT.invite), el('b', 'camp-fold-code', formatCode(campaign.code)), el('span', 'camp-fold-arrow', expanded ? '▾' : '▸'));
    if (!expanded) return [fold];
    const body = el('div', 'camp-fold-body');
    const acts = el('div', 'charlist-actions');
    acts.append(button('Копировать ссылку', 'charlist-btn', () => copyLink(campaign)), button('Сменить код', 'charlist-btn', () => regenerate(campaign)));
    body.append(acts);
    if (ready && entry.rows.length) {
        const list = el('div', 'camp-roster');
        list.append(...rosterView(entry.rows, state.db).map(m => memberElement(campaign, m, true)));
        body.append(el('p', 'camp-sec', TEXT.members), list);
    }
    return [fold, body];
}

// ── Отрисовка ──

// Строка группы: у мастера (в «Приглашении») — с «Исключить»
function memberElement(campaign, member, isGm) {
    const item = el('div', 'charlist-item camp-member' + (member.mine ? ' charlist-current' : ''));
    item.dataset.member = member.id;
    const head = el('div', 'charlist-head');
    const main = el('div', 'charlist-row');
    main.append(el('span', 'charlist-av', member.initials));
    const text = el('span', 'charlist-text');
    text.append(el('b', 'charlist-name', member.name), el('span', 'charlist-sub', member.sub));
    main.append(text);
    head.append(main);
    if (isGm) {
        const kickButton = button('Исключить', 'charlist-btn charlist-danger camp-kick', () => kick(campaign, member));
        kickButton.setAttribute('aria-label', `Исключить: ${member.name}`);
        head.append(kickButton);
    }
    item.append(head);
    return item;
}

// Группа у игрока
function rosterElements(campaign) {
    const entry = rosters.get(campaign.id);
    if (!entry || entry.status === 'loading') return [el('p', 'camp-empty', TEXT.rosterLoading)];
    if (entry.status === 'failed') {
        return [el('p', 'camp-empty', TEXT.rosterFailed), button('Повторить', 'charlist-btn', () => { rosters.delete(campaign.id); loadCurrentRoster(); })];
    }
    const members = rosterView(entry.rows, state.db);
    if (!members.length) return [el('p', 'camp-empty', TEXT.empty)];
    const list = el('div', 'camp-roster');
    list.append(...members.map(m => memberElement(campaign, m, false)));
    return [list];
}

function campaignElements(campaign) {
    const isGm = campaign.role === 'gm';
    const nodes = [];
    const titleRow = el('div', 'camp-title-row');
    titleRow.append(el('h2', 'camp-name', campaign.name));
    if (isGm) {
        const edit = button('✎', 'camp-edit', () => renameFlow(campaign));
        edit.setAttribute('aria-label', 'Переименовать кампанию');
        titleRow.append(edit);
    }
    nodes.push(titleRow);
    if (isGm) {
        // «вы мастер · N персонажей» и справа «на 19:42 ↻» — когда загружены карточки; нажатие — заново
        const subRow = el('div', 'camp-sub-row');
        subRow.append(el('p', 'camp-sub', campaignSubline(campaign)));
        const entry = rosters.get(campaign.id);
        if (entry?.status === 'ready') {
            // Связь есть, последняя догрузка удалась — «Актуально»; иначе «нет связи · с ЧЧ:ММ»
            const live = !entry.stale && !isOffline() && watch?.campaignId === campaign.id && watch.feed.live();
            const { text, label } = liveLabel(live, entry.at);
            const fresh = button('', 'camp-fresh ' + (live ? 'camp-fresh-live' : 'camp-fresh-lost'), () => refreshParty(campaign.id));
            fresh.append(el('span', 'camp-fresh-dot'), el('span', null, text));
            fresh.setAttribute('aria-label', label);
            if (entry.busy) fresh.setAttribute('aria-busy', 'true');
            subRow.append(fresh);
        }
        const actions = el('div', 'charlist-actions');
        actions.append(button('Удалить кампанию', 'charlist-btn charlist-danger', () => trash(campaign)));
        return [...nodes, subRow, destinyRowElement(), ...partyElements(campaign), ...inviteElements(campaign), actions];
    }
    nodes.push(el('p', 'camp-sub', campaignSubline(campaign)));
    if (campaign.deleted_at) {
        const actions = el('div', 'charlist-actions');
        actions.append(button('Выйти из кампании', 'charlist-btn charlist-danger', () => leave(campaign)));
        return [...nodes, el('p', 'camp-warn', trashedNotice(campaign)), actions];
    }
    const entry = rosters.get(campaign.id);
    const count = entry?.status === 'ready' ? entry.rows.length : campaign.members;
    nodes.push(el('p', 'camp-sec', `Группа · ${count}`), ...rosterElements(campaign));
    const actions = el('div', 'charlist-actions');
    actions.append(button('Выйти из кампании', 'charlist-btn charlist-danger', () => leave(campaign)));
    nodes.push(actions);
    return nodes;
}

function trashElements(list) {
    if (!list.length) return [];
    const box = el('div', 'camp-trash');
    for (const campaign of list) {
        const row = el('div', 'camp-trash-row');
        row.dataset.trash = campaign.id;
        const text = el('span', 'camp-trash-text');
        text.append(el('b', 'charlist-name', campaign.name), el('span', 'charlist-sub', trashMeta(campaign)));
        row.append(text, button('Восстановить', 'charlist-btn', () => restore(campaign)), button('Удалить навсегда', 'charlist-btn charlist-danger', () => purge(campaign)));
        box.append(row);
    }
    return [el('p', 'camp-sec', 'Удалённые'), box];
}

// Карточки обновляются вживую (этап 5), поэтому перерисовка не должна мешать тому, кто нажимает.
// Пока кнопка нажата (мышь, палец), перерисовка ждёт: иначе нажатие и отпускание придутся на разные
// узлы и click потеряется. Отпустили — перерисовка после click (он идёт следом в той же задаче).
// Зависшее нажатие (отпустили за окном) держит не дольше PRESS_MAX_MS
const PRESS_MAX_MS = 1500;
let pressed = false;
let pressTimer = null;
let renderLater = false;

function press() {
    pressed = true;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(release, PRESS_MAX_MS);
}

function release() {
    if (!pressed) return;
    pressed = false;
    clearTimeout(pressTimer);
    if (renderLater) setTimeout(() => { if (!pressed && renderLater) { renderLater = false; render(); } }, 0);
}

// Кнопка в фокусе — по области (карточка, участник, строка корзины), первому классу и номеру среди
// таких же: после перерисовки фокус возвращается на такую же новую кнопку
function focusedKey(body) {
    const active = document.activeElement;
    if (!active || active === body || !body.contains(active) || !active.classList[0]) return null;
    const scope = active.closest('[data-card], [data-member], [data-trash]');
    const where = scope ? Object.entries(scope.dataset).map(([k, v]) => `[data-${k}="${CSS.escape(v)}"]`).join('') + ' ' : '';
    const selector = where + '.' + CSS.escape(active.classList[0]);
    return { selector, index: [...body.querySelectorAll(selector)].indexOf(active) };
}

function restoreFocus(body, key) {
    if (!key) return;
    const node = body.querySelectorAll(key.selector)[key.index];
    if (node && document.activeElement !== node) node.focus({ preventScroll: true });
}

function render() {
    if (!open) return;
    if (pressed) { renderLater = true; return; }
    renderLater = false;
    syncWatch();
    const body = byId('campaigns-body');
    const focus = focusedKey(body);
    if (status === 'loading') { body.replaceChildren(el('p', 'camp-empty', TEXT.loading)); return; }
    if (status === 'offline') {
        const empty = el('p', 'camp-empty', TEXT.offline);
        body.replaceChildren(empty, el('p', 'camp-hint camp-empty', TEXT.offlineNote));
        return;
    }
    if (status === 'failed') {
        body.replaceChildren(el('p', 'camp-empty', TEXT.failed), button('Повторить', 'charlist-btn', reload));
        return;
    }
    const view = screenView(rows, selectedId);
    selectedId = view.current?.id ?? null;
    const nodes = [];
    if (view.showSwitcher) {
        const switcher = el('div', 'camp-switch');
        switcher.setAttribute('role', 'group');
        switcher.setAttribute('aria-label', 'Кампании');
        for (const tab of view.tabs) {
            const item = button(tab.name, 'camp-tab', () => {
                if (tab.id === selectedId) return;
                selectedId = tab.id;
                flash = null;
                inviteOpen = null;
                hintFor = null;
                // Дашборд ведомой — заново, как первый показ: переключение не повод для вспышек (этап 5)
                if (tab.role === 'gm') rosters.delete(tab.id);
                render();
                loadCurrentRoster();
            });
            item.setAttribute('aria-pressed', String(tab.id === selectedId));
            switcher.append(item);
        }
        nodes.push(switcher);
    }
    if (flash) {
        const ok = el('p', 'camp-ok', flash);
        ok.setAttribute('role', 'status');
        nodes.push(ok);
    }
    if (view.current) nodes.push(...campaignElements(view.current));
    if (view.empty) {
        const empty = el('p', 'camp-empty', TEXT.empty);
        empty.append(el('br'), document.createTextNode(TEXT.emptyNote));
        nodes.push(empty);
    }
    const actions = el('div', 'camp-actions');
    actions.append(button('Вступить по коду', 'charlist-btn charlist-btn-pri', join), button('+ Создать кампанию', 'charlist-btn', () => createFlow(view.atLimit)));
    nodes.push(actions, ...trashElements(view.trash));
    body.replaceChildren(...nodes);
    restoreFocus(body, focus);
    if (hintFor) placeHint();
}

// ── Загрузка ──

// Группы кампании нет доступа (forbidden): мастер удалил кампанию или исключил последнего моего
// персонажа, пока экран был закрыт; у мастера — кампания ушла в корзину с другого устройства.
// Сообщение и свежие данные — но сам экран перезагружается не больше раза за открытие (если
// my_campaigns и campaign_roster разойдутся, дальше — «Повторить», а не круг)
function forbidden(campaignId, result) {
    if (!autoReloaded) {
        autoReloaded = true;
        rosters.delete(campaignId);
        failed(result);
        return;
    }
    rosters.set(campaignId, { status: 'failed', rows: [], sheets: new Map(), flashes: new Map() });
    render();
}

async function loadCurrentRoster() {
    const current = screenView(rows, selectedId).current;
    if (!current || current.deleted_at || rosters.has(current.id)) return;
    // Дашборд мастера: состав и листы группы для карточек
    if (current.role === 'gm') { await loadParty(current.id); return; }
    rosters.set(current.id, { status: 'loading', rows: [] });
    render();
    const result = await loadRoster(current.id);
    if (!open) return;
    if (result.error === 'forbidden') { forbidden(current.id, result); return; }
    rosters.set(current.id, result.ok ? { status: 'ready', rows: result.rows } : { status: 'failed', rows: [] });
    render();
}

async function load() {
    if (isOffline()) { status = 'offline'; render(); return; }
    status = 'loading';
    render();
    const listed = await listCampaigns();
    if (!open) return;
    if (!listed.ok) { status = 'failed'; render(); return; }
    rows = listed.rows;
    status = 'ready';
    // Подпись в «Заметках» открытого персонажа — по свежему составу кампаний
    noteCampaigns(rows);
    render();
    await loadCurrentRoster();
}

function wire() {
    if (wired) return;
    wired = true;
    // Пока грузится лист карточки, остальное на экране неактивно: × ничего не делает
    byId('campaigns-close').addEventListener('click', () => { if (!opening) closeCampaigns(); });
    const input = byId('campaign-name-input');
    input.addEventListener('input', () => { setNameError(''); refreshNameSave(!nameSave); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });
    byId('campaign-name-save').addEventListener('click', saveName);
    // Сеть вернулась, пока экран показывал «Нужна сеть», — загрузить
    window.addEventListener('online', () => { if (open && status === 'offline') load(); });
    // Живой дашборд (party-live.js): сеть пропала / вернулась, страница снова видна — догрузка
    window.addEventListener('online', () => { if (!reviveWatch()) watch?.feed.network(true); });
    window.addEventListener('offline', () => watch?.feed.network(false));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !reviveWatch()) watch?.feed.shown();
    });
    attachPull(byId('campaigns-screen'), byId('camp-pull'), { enabled: pullEnabled, refresh: pullRefresh });
    // Нажатие внутри экрана держит перерисовку до отпускания (press / release выше)
    byId('campaigns-body').addEventListener('pointerdown', press, true);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    // Esc: раньше общего обработчика (char-setup-modal.js). Поверх экрана открыто окно снизу или
    // сообщение — Esc закрывает только его (это делают bottom-sheet.js и char-setup-modal.js);
    // открыта подсказка «✚» — только её
    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !open || isSheetOpen()) return;
        if (!byId('modal-overlay').classList.contains('hidden')) return;
        e.stopImmediatePropagation();
        if (opening) return;
        if (hintFor) closeHint(); else closeCampaigns();
    }, true);
    // Нажатие мимо подсказки «✚» закрывает её и больше ничего не делает
    byId('campaigns-screen').addEventListener('click', (e) => {
        if (!hintFor || e.target.closest('.party-hint, .party-crit')) return;
        e.stopPropagation();
        e.preventDefault();
        hintFor = null;
        render();
    }, true);
}

// select — какую кампанию показать; flash — сообщение над ней (после вступления)
export async function openCampaigns({ select = null, flash: message = null } = {}) {
    wire();
    if (!open) returnFocus = document.activeElement;
    open = true;
    if (select) selectedId = select;
    flash = message;
    inviteOpen = null;
    hintFor = null;
    opening = null;
    autoReloaded = false;
    busy = false;
    rosters.clear();
    byId('campaigns-screen').classList.remove('hidden');
    byId('campaigns-close').focus();
    await load();
}

// keepParty — экран закрывается ради просмотра листа игрока (party-view.js): дашборд запоминается,
// чтобы по «← Группа» показать изменившиеся карточки вспышкой. Подписка в любом случае снимается
export function closeCampaigns({ keepParty = false } = {}) {
    if (!open) return;
    const entry = rosters.get(selectedId);
    memory = keepParty && entry?.cards ? { campaignId: selectedId, entry: { ...entry, busy: false, again: false, flashes: new Map() } } : null;
    stopWatch();
    open = false;
    setDestinyScreen(false);
    flash = null;
    byId('campaigns-screen').classList.add('hidden');
    // Открыли из меню ☰ (оно уже скрыто) — фокус на кнопку меню
    const visible = returnFocus && document.contains(returnFocus) && returnFocus.offsetParent !== null;
    (visible ? returnFocus : byId('menu-btn')).focus();
    returnFocus = null;
}

export function isCampaignsOpen() {
    return open;
}
