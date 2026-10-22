import { openSheet, closeSheet } from './bottom-sheet.js';
import { isOffline } from './net-status.js';
import { destinyPool, spendDestiny, undoDestiny, setDestiny, watchDestiny } from './campaign-store.js';
import { makePartyFeed } from './party-live.js';
import {
    readPool, newerPool, isUnset, rowView, eventBar, spentBar, noteText, liveText, clock, stepSide, failText, makeBar,
    SIDE_MAX,
} from './destiny-model.js';

// Общий пул Судьбы стола (этап 5, часть 2, спека 2026-10-21-destiny-pool.md; макеты pool-placement.html,
// pool-gm.html, pool-who.html — вариант A, «Задать пул» — Р1). Один пул на кампанию: строка «Судьба» в
// карточке персонажа (#hud-destiny) и на дашборде мастера (destinyRowElement), по нажатию — панель
// «Судьба стола» (#destiny-panel), у мастера ещё окно «Задать пул» (#destiny-set). Чей пул показан —
// решают три источника: открытый свой персонаж (character-session.js), лист игрока в просмотре мастера
// (party-view.js) и экран «Кампании» (campaigns-screen.js); экран главнее, просмотр — главнее своего.
// Пока пул показан, он живой: закрытый канал destiny:<id кампании> приносит пул после каждого
// действия; чужое действие — вспышка строки и плашка «кто что» (#destiny-bar). Без связи — последнее
// известное состояние, «нет связи · с Ч:ММ», траты недоступны. Тексты — только textContent.
const byId = id => document.getElementById(id);
// Вспышка строки после чужого действия, мс (style.css, .destiny-flash)
const FLASH_MS = 1000;
const TEXT = {
    undo: 'Отменить',
    spendLight: 'Потратить светлый жетон',
    spendDark: 'Потратить тёмный жетон',
    offline: 'Без связи пул только виден — нажатие вернёт связь',
    unsetPlayer: 'Мастер ещё не задал пул',
    unsetGm: 'Пул не задан',
};

let sheet = null;       // { campaignId, characterId } — открытый свой персонаж в активной кампании
let view = null;        // id кампании листа игрока в просмотре мастера
let screen = false;     // экран «Кампании»: false — закрыт; null — открыт без дашборда; id — дашборд ведомой
let ctx = null;         // показанный пул: { campaignId, characterId, viewOnly, dashboard }
// id кампании → { pool, role, campaign, at — когда пришли последние данные, stale — последнее
// чтение не удалось, gone — пула этой кампании нам больше не видно }
const known = new Map();
let watch = null;       // { campaignId, feed (party-live.js), stop, dead }
let flashAt = -Infinity;
let busy = false;       // идёт своё действие
let held = [];          // сообщения канала, пришедшие во время своего действия
let draft = null;       // счётчики окна «Задать пул»: { light, dark }
let wired = false;

const bar = makeBar({ show: showBar, hide: hideBar, setTimer: setTimeout, clearTimer: clearTimeout });

// ── Кто показан ──

function wanted() {
    if (screen !== false) return screen ? { campaignId: screen, characterId: null, viewOnly: false, dashboard: true } : null;
    if (view) return { campaignId: view, characterId: null, viewOnly: true, dashboard: false };
    return sheet ? { campaignId: sheet.campaignId, characterId: sheet.characterId, viewOnly: false, dashboard: false } : null;
}

function sync() {
    wire();
    const next = wanted();
    const changed = next?.campaignId !== ctx?.campaignId;
    ctx = next;
    if (changed) {
        stopWatch();
        bar.clear();
        held = [];
        // Память — только о показанном пуле: другой показ начинается с чтения
        known.clear();
        if (isOpen('destiny-panel') || isOpen('destiny-set')) closeSheet({ force: true });
        if (ctx) { startWatch(ctx.campaignId); read(ctx.campaignId); }
    } else if (ctx && known.get(ctx.campaignId)?.gone) {
        // Тот же персонаж снова в кампании (вступил после исключения) — пул виден снова
        read(ctx.campaignId);
    }
    render();
}

// Открытый свой персонаж: { campaignId, characterId } — он в активной кампании; null — нет.
// Зовётся при каждом открытии персонажа и свежем составе кампаний (character-session.js)
export function setDestinySheet(next) {
    sheet = next;
    sync();
}

// Просмотр листа игрока мастером: id кампании; null — просмотр закончен
export function setDestinyView(campaignId) {
    if (view === campaignId) return;
    view = campaignId;
    sync();
}

// Экран «Кампании»: false — закрыт; null — открыт, дашборда нет (игрок, загрузка, кампания в корзине);
// id — показан дашборд ведомой кампании
export function setDestinyScreen(value) {
    if (screen === value) return;
    screen = value;
    sync();
}

// ── Данные ──

const entryOf = id => known.get(id) ?? known.set(id, { pool: null, role: null, campaign: '', at: null, stale: false, gone: false }).get(id);

// Перечитать пул (показ, подключение канала, сеть вернулась, нажатие на отметку). Без событий:
// пропущенные, пока связи не было, траты видны по новому пулу и строке «Последнее»
async function read(campaignId) {
    const entry = entryOf(campaignId);
    if (isOffline()) { entry.stale = true; render(); return; }
    const result = await destinyPool(campaignId);
    if (result.ok) {
        Object.assign(entry, { pool: newerPool(entry.pool, readPool(result.pool)), role: result.role, campaign: result.campaign, at: new Date(), stale: false, gone: false });
    } else if (result.error === 'forbidden') {
        entry.gone = true;
    } else {
        entry.stale = true;
    }
    render();
}

// Сообщение канала: пул после чьего-то действия. Своё действие ещё идёт — сообщение ждёт ответа:
// после него сообщение своего действия уже не новее известного пула и не показывается чужим
function message(campaignId, raw) {
    if (busy) { held.push([campaignId, raw]); return; }
    const next = readPool(raw);
    const entry = known.get(campaignId);
    if (!next || !entry?.pool || next.seq <= entry.pool.seq) return;
    Object.assign(entry, { pool: next, at: new Date(), stale: false });
    if (next.last) {
        flashAt = Date.now();
        bar.foreign(eventBar(next.last, next));
    }
    render();
}

function release() {
    const list = held;
    held = [];
    for (const [campaignId, raw] of list) message(campaignId, raw);
}

// Своё действие с пулом: пул из ответа
function took(campaignId, pool) {
    const next = readPool(pool);
    const entry = entryOf(campaignId);
    if (next) Object.assign(entry, { pool: newerPool(entry.pool, next), at: new Date(), stale: false });
}

async function act(run) {
    if (busy || !ctx) return;
    const campaignId = ctx.campaignId;
    busy = true;
    render();
    try {
        await run(campaignId);
    } finally {
        busy = false;
        release();
        render();
    }
}

function spend() {
    if (!ctx || ctx.viewOnly || !live()) return;
    const entry = entryOf(ctx.campaignId);
    const side = entry.role === 'gm' ? 'dark' : 'light';
    const characterId = ctx.characterId;
    act(async (campaignId) => {
        const result = await spendDestiny(campaignId, side, side === 'light' ? characterId : null);
        if (ctx?.campaignId !== campaignId) return;
        if (result.ok) {
            took(campaignId, result.pool);
            bar.own(spentBar(side, () => undo(campaignId, result.action)));
            return;
        }
        bar.own({ text: failText('spend', result.error) });
        if (result.error === 'forbidden') entryOf(campaignId).gone = true;
        // «Уже потрачен» — пул изменился раньше, чем пришло сообщение: свежий
        else read(campaignId);
    });
}

function undo(campaignId, action) {
    act(async () => {
        const result = await undoDestiny(campaignId, action);
        if (ctx?.campaignId !== campaignId) return;
        if (result.ok) { took(campaignId, result.pool); bar.dismiss(); return; }
        bar.own({ text: failText('undo', result.error) });
        if (result.error === 'forbidden') entryOf(campaignId).gone = true;
        else read(campaignId);
    });
}

// ── Связь ──

function live() {
    const entry = ctx && known.get(ctx.campaignId);
    return !!entry?.pool && !entry.stale && !isOffline() && watch?.campaignId === ctx.campaignId && watch.feed.live();
}

function startWatch(campaignId) {
    const feed = makePartyFeed({
        changed() {},
        resync: () => read(campaignId),
        update: render,
        setTimer: setTimeout, clearTimer: clearTimeout,
    });
    // dead — канал закрыт не нами или не создался: сам не вернётся (revive)
    const entry = { campaignId, feed, dead: false, stop: null };
    watch = entry;
    entry.stop = watchDestiny(campaignId, {
        pool: raw => message(campaignId, raw),
        status: (state) => { if (state === 'closed') entry.dead = true; feed.channel(state); },
    });
    if (isOffline()) feed.network(false);
}

function stopWatch() {
    if (watch) { watch.feed.stop(); watch.stop(); }
    watch = null;
}

// Мёртвый канал — подписаться заново (его подключение перечитает пул). → true, если подписались
function revive() {
    if (!watch?.dead || isOffline()) return false;
    const { campaignId } = watch;
    stopWatch();
    startWatch(campaignId);
    return true;
}

// Нажатие на отметку «Актуально» / «нет связи»: перечитать пул
function refresh() {
    if (!ctx) return;
    if (!revive()) read(ctx.campaignId);
}

// ── Отрисовка ──

const isOpen = id => !byId(id).classList.contains('hidden');

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function tokenElements(n, side) {
    return Array.from({ length: n }, () => el('i', `destiny-tk destiny-tk-${side}`));
}

// Показанный пул: { entry, pool } или null — показывать нечего (контекста нет, пул ещё не пришёл,
// кампания больше не видна)
function shown() {
    const entry = ctx && known.get(ctx.campaignId);
    return entry?.pool && !entry.gone ? { entry, pool: entry.pool } : null;
}

// Строка «Судьба»: подпись, кружки светлых | тёмных, «3 : 4 ›»; без кружков — больше 10 жетонов
function fillRow(row, data) {
    const look = rowView(data.pool, data.entry.role);
    const parts = [el('em', 'destiny-label', 'Судьба')];
    if (look.unset) {
        parts.push(el('span', 'destiny-unset', look.text));
    } else {
        if (look.circles) {
            const tokens = el('span', 'destiny-tks');
            tokens.append(...tokenElements(data.pool.light, 'l'), el('span', 'destiny-split'), ...tokenElements(data.pool.dark, 'd'));
            parts.push(tokens);
        }
        parts.push(el('b', 'destiny-num', look.text));
    }
    parts.push(el('span', 'destiny-chev', '›'));
    row.replaceChildren(...parts);
    for (const part of parts) part.setAttribute('aria-hidden', 'true');
    row.setAttribute('aria-label', `${look.label}. Открыть «Судьба стола»`);
    // Вспышка после чужого действия: перерисовка посреди неё продолжает её с того же места; новое
    // чужое действие — анимация заново (класс прошлой вспышки ещё может быть на строке: #hud-destiny
    // не пересоздаётся, а после погасшей вспышки перерисовки могло не быть)
    const age = Date.now() - flashAt;
    if (age < FLASH_MS) {
        row.style.setProperty('--flash-at', `-${age}ms`);
        if (row.dataset.flashAt !== String(flashAt)) {
            row.classList.remove('destiny-flash');
            void row.offsetWidth;
            row.dataset.flashAt = String(flashAt);
        }
    }
    row.classList.toggle('destiny-flash', age < FLASH_MS);
}

// Строка для дашборда мастера (campaigns-screen.js рисует её над карточками группы)
export function destinyRowElement() {
    wire();
    const row = el('button', 'destiny-row destiny-row-camp');
    row.type = 'button';
    row.dataset.roOk = '';
    row.addEventListener('click', openPanel);
    const data = shown();
    if (data) fillRow(row, data); else row.hidden = true;
    return row;
}

function render() {
    if (!wired) return;
    const data = shown();
    const home = byId('hud-destiny');
    home.hidden = !data || ctx.dashboard;
    if (!home.hidden) fillRow(home, data);
    for (const row of document.querySelectorAll('.destiny-row-camp')) {
        row.hidden = !data || !ctx.dashboard;
        if (!row.hidden) fillRow(row, data);
    }
    if (!data) {
        if (isOpen('destiny-panel') || isOpen('destiny-set')) closeSheet({ force: true });
        return;
    }
    if (isOpen('destiny-panel')) fillPanel(data);
    if (isOpen('destiny-set')) fillSet();
}

function fillPanel({ entry, pool }) {
    const ok = live();
    const gm = entry.role === 'gm';
    const mark = byId('destiny-live');
    const text = liveText(ok, entry.at ?? new Date());
    mark.replaceChildren(el('span', 'camp-fresh-dot'), el('span', null, text));
    mark.className = 'camp-fresh ' + (ok ? 'camp-fresh-live' : 'camp-fresh-lost');
    mark.setAttribute('aria-label', ok ? 'Обновить пул — данные актуальны' : `Обновить пул — нет связи с ${clock(entry.at ?? new Date())}`);
    byId('destiny-sub').textContent = `Кампания «${entry.campaign}» · ${gm && !ctx.viewOnly ? 'вы мастер' : 'общий пул для всех'}`;
    const unset = isUnset(pool);
    byId('destiny-sides').hidden = unset;
    byId('destiny-unset').hidden = !unset;
    byId('destiny-unset').textContent = gm ? TEXT.unsetGm : TEXT.unsetPlayer;
    byId('destiny-light-n').textContent = String(pool.light);
    byId('destiny-dark-n').textContent = String(pool.dark);
    byId('destiny-light-tokens').replaceChildren(...tokenElements(pool.light, 'l'));
    byId('destiny-dark-tokens').replaceChildren(...tokenElements(pool.dark, 'd'));
    const spendButton = byId('destiny-spend');
    spendButton.hidden = ctx.viewOnly || unset;
    spendButton.replaceChildren(el('i', `destiny-tk destiny-tk-${gm ? 'd' : 'l'}`), document.createTextNode(gm ? TEXT.spendDark : TEXT.spendLight));
    spendButton.classList.toggle('destiny-spend-dark', gm);
    spendButton.disabled = busy || !ok || (gm ? pool.dark : pool.light) === 0;
    const setButton = byId('destiny-set-open');
    setButton.hidden = !gm || ctx.viewOnly;
    setButton.disabled = busy || !ok;
    byId('destiny-hint').hidden = ok || ctx.viewOnly;
    byId('destiny-hint').textContent = TEXT.offline;
    byId('destiny-note').textContent = noteText(pool);
}

function fillSet() {
    const ok = live();
    byId('destiny-set-light').textContent = String(draft.light);
    byId('destiny-set-dark').textContent = String(draft.dark);
    byId('destiny-set-total').textContent = `Всего жетонов: ${draft.light + draft.dark}`;
    byId('destiny-set-light-minus').disabled = draft.light === 0;
    byId('destiny-set-light-plus').disabled = draft.light === SIDE_MAX;
    byId('destiny-set-dark-minus').disabled = draft.dark === 0;
    byId('destiny-set-dark-plus').disabled = draft.dark === SIDE_MAX;
    byId('destiny-set-apply').disabled = busy || !ok;
}

function openPanel() {
    const data = shown();
    if (!data) return;
    openSheet('destiny-panel');
    fillPanel(data);
}

// «Задать пул…»: счётчики — с нынешним пулом; чужие траты, пока окно открыто, их не меняют
function openSet() {
    const data = shown();
    if (!data || data.entry.role !== 'gm' || ctx.viewOnly) return;
    draft = { light: Math.min(data.pool.light, SIDE_MAX), dark: Math.min(data.pool.dark, SIDE_MAX) };
    byId('destiny-set-error').hidden = true;
    openSheet('destiny-set');
    fillSet();
}

function step(side, delta) {
    if (!draft) return;
    draft[side] = stepSide(draft[side], delta);
    fillSet();
}

// «Применить» — пул задан, снова панель; «Отмена» — без изменений, снова панель
function applySet() {
    if (!draft || !live()) return;
    const { light, dark } = draft;
    act(async (campaignId) => {
        const result = await setDestiny(campaignId, light, dark);
        if (ctx?.campaignId !== campaignId) return;
        if (result.ok) {
            took(campaignId, result.pool);
            draft = null;
            openPanel();
            return;
        }
        byId('destiny-set-error').textContent = failText('set', result.error);
        byId('destiny-set-error').hidden = false;
    });
}

function cancelSet() {
    draft = null;
    openPanel();
}

// ── Плашка ──

// item — { text, undo?, from?, to? ('l' | 'd'), who? (начало text — жирным), gm? }: жетоны «откуда → куда»
// у трат, полоска слева у чужих действий — мастера или игрока (макеты pool-who.html, pool-placement.html)
function showBar(item) {
    const tokens = byId('destiny-bar-tokens');
    tokens.hidden = !item.from;
    tokens.replaceChildren(...(item.from ? [el('i', `destiny-tk destiny-tk-${item.from}`), el('span', 'destiny-bar-arr', '→'), el('i', `destiny-tk destiny-tk-${item.to}`)] : []));
    const text = byId('destiny-bar-text');
    if (item.who && item.text.startsWith(item.who)) text.replaceChildren(el('b', null, item.who), document.createTextNode(item.text.slice(item.who.length)));
    else text.textContent = item.text;
    const foreign = item.gm !== undefined;
    byId('destiny-bar').classList.toggle('destiny-bar-gm', foreign && item.gm);
    byId('destiny-bar').classList.toggle('destiny-bar-player', foreign && !item.gm);
    const button = byId('destiny-bar-undo');
    button.hidden = !item.undo;
    button.onclick = item.undo ?? null;
    byId('destiny-bar').classList.remove('hidden');
}

function hideBar() {
    byId('destiny-bar').classList.add('hidden');
    byId('destiny-bar-undo').onclick = null;
}

function wire() {
    if (wired) return;
    wired = true;
    byId('hud-destiny').addEventListener('click', openPanel);
    byId('destiny-live').addEventListener('click', refresh);
    byId('destiny-spend').addEventListener('click', spend);
    byId('destiny-set-open').addEventListener('click', openSet);
    byId('destiny-set-apply').addEventListener('click', applySet);
    byId('destiny-set-cancel').addEventListener('click', cancelSet);
    for (const side of ['light', 'dark']) {
        byId(`destiny-set-${side}-minus`).addEventListener('click', () => step(side, -1));
        byId(`destiny-set-${side}-plus`).addEventListener('click', () => step(side, 1));
    }
    // Сеть пропала / вернулась, страница снова видна — перечитать пул (party-live.js решает когда)
    window.addEventListener('online', () => { if (!revive()) watch?.feed.network(true); });
    window.addEventListener('offline', () => { watch?.feed.network(false); render(); });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !revive()) watch?.feed.shown();
    });
}
