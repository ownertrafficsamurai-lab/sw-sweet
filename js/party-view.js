import { checkSave } from './save-check.js';
import { displayName } from './character-list-model.js';
import { flipTargets } from './party-model.js';
import { loadSheet } from './campaign-store.js';
import { enterView, showViewed, leaveView, currentCharacterId } from './character-session.js';
import { saveReference } from './persistence.js';
import { setViewOnly, isOffline } from './net-status.js';
import { isSheetOpen } from './bottom-sheet.js';
import { closeShade } from './hud-collapse.js';
import { switchTab, showAlert, showToast } from './ui-utils.js';
import { openCampaigns, closeCampaigns, isCampaignsOpen } from './campaigns-screen.js';
import { setDestinyView } from './destiny-pool.js';

// Просмотр листа игрока мастером (4.2, спека 2026-10-14-gm-dashboard.md, макет sheet-view.html —
// вариант B). Нажатие на карточку дашборда (campaigns-screen.js) подменяет лист: свой персонаж
// мастера — в памяти (character-session.js enterView), лист игрока загружается заново и через
// checkSave ложится на тот же лист. В верхней строке шапки вместо логотипа и ☰ — шапка просмотра
// «← Группа», ‹ имя · игрок ›, «только просмотр», точки (#view-head; на телефоне закреплена).
// Всё, что меняет персонажа, не нажимается (net-status.js setViewOnly), на первое такое нажатие в
// просмотре — подсказка. Выход — «← Группа» или Esc: свой — из памяти, экран «Кампании» на той же
// кампании. Перезагрузка страницы просмотр не сохраняет.
const byId = id => document.getElementById(id);
const TEXT = {
    loadFailed: 'Не удалось загрузить лист. Проверьте подключение к интернету.',
    gone: 'Персонаж больше не в кампании',
    unreadable: 'Лист не читается',
    readOnly: 'Только просмотр — лист меняет игрок',
    prev: 'Предыдущий персонаж',
    next: 'Следующий персонаж',
};
// Окна поверх листа: пока открыто любое, Esc закрывает его, а не просмотр (панели снизу и шторку
// закрывают bottom-sheet.js и hud-collapse.js — их слушатели срабатывают раньше и останавливают Esc)
const LAYERS = ['modal-overlay', 'stat-panel', 'char-setup-modal', 'text-size-menu', 'system-menu'];

// { campaignId, cards, id, name, hinted } — кампания, карточки дашборда (для ‹ ›), открытый персонаж,
// имя для шапки и была ли подсказка; null — просмотра нет
let view = null;
let busy = false;   // идёт загрузка листа
// Растёт при выходе: лист, загрузка которого шла до выхода, на лист уже не кладётся
let epoch = 0;
let wired = false;

// Загрузить лист игрока и положить его на лист. → { shown, name } | { missing } | {} (сообщение показано).
// ownId задан при открытии с экрана «Кампании»: экран закрыт или открыт другой свой персонаж, пока
// шла загрузка, — лист на лист не кладётся
async function loadAndShow(id, ownId) {
    const mine = epoch;
    const loaded = isOffline() ? { error: 'network' } : await loadSheet(id);
    if (mine !== epoch) return {};
    if (ownId !== undefined && (!isCampaignsOpen() || currentCharacterId() !== ownId)) return {};
    if (loaded.missing) { showAlert(TEXT.gone); return { missing: true }; }
    if (!loaded.ok) { showAlert(TEXT.loadFailed); return {}; }
    const checked = checkSave(loaded.data, saveReference());
    if (!checked.ok) { showAlert(TEXT.unreadable); return {}; }
    showViewed(checked);
    return { shown: true, name: displayName(checked.save.charName) };
}

function renderHead() {
    const card = view.cards.find(c => c.id === view.id);
    byId('view-name').textContent = `${view.name} · ${card?.player ?? 'игрок'}`;
    const flip = flipTargets(view.cards, view.id);
    const many = flip.total > 1;
    for (const [id, target, label] of [['view-prev', flip.prev, TEXT.prev], ['view-next', flip.next, TEXT.next]]) {
        const arrow = byId(id);
        arrow.hidden = !many;
        arrow.disabled = busy || target === null;
        const name = view.cards.find(c => c.id === target)?.name;
        arrow.setAttribute('aria-label', name ? `${label}: ${name}` : label);
    }
    const dots = byId('view-dots');
    dots.hidden = !many;
    dots.replaceChildren(...Array.from({ length: many ? flip.total : 0 }, (_, i) => {
        const dot = document.createElement('i');
        if (i === flip.index) dot.className = 'on';
        return dot;
    }));
}

// Первое заблокированное нажатие в просмотре — подсказка; следующие молча
function onBlocked() {
    if (!view || view.hinted) return;
    view.hinted = true;
    showToast(TEXT.readOnly, 'info');
}

// Высота закреплённой шапки просмотра на телефоне — отступ шапки и мини-блока (style.css, --view-h)
function setViewHeight() {
    const row = document.querySelector('.hud-toprow');
    document.documentElement.style.setProperty('--view-h', view ? row.offsetHeight + 'px' : '0px');
}

function wire() {
    if (wired) return;
    wired = true;
    byId('view-back').addEventListener('click', () => { leave(); });
    byId('view-prev').addEventListener('click', () => { flip('prev'); });
    byId('view-next').addEventListener('click', () => { flip('next'); });
    new ResizeObserver(() => { if (view) setViewHeight(); }).observe(document.querySelector('.hud-toprow'));
}

// Нажатие на чужую читаемую карточку дашборда. cards — карточки группы (party-model.js partyCards).
// → 'shown' — лист открыт, экран «Кампании» закрыт; 'missing' — персонажа больше нет в кампании
// (экран обновляет группу); 'stay' — не открылся (сообщение показано)
export async function openView(campaignId, cards, id) {
    if (view || busy) return 'stay';
    wire();
    busy = true;
    try {
        if (!await enterView()) return 'stay';
        const result = await loadAndShow(id, currentCharacterId());
        if (!result.shown) { leaveView(); return result.missing ? 'missing' : 'stay'; }
        view = { campaignId, cards, id, name: result.name, hinted: false };
    } finally {
        busy = false;
    }
    document.body.classList.add('sheet-viewing');
    setViewOnly(onBlocked);
    setViewHeight();
    renderHead();
    // Пул Судьбы кампании — в карточке листа, только смотреть (этап 5, часть 2)
    setDestinyView(campaignId);
    closeCampaigns({ keepParty: true });
    switchTab('generator');
    window.scrollTo(0, 0);
    byId('view-back').focus();
    return 'shown';
}

// ‹ › — соседний персонаж загружается заново; вкладка сохраняется, прокрутка — наверх. Не
// загрузился — остаёмся на текущем; его больше нет в кампании — возврат к обновлённой группе
async function flip(dir) {
    if (!view || busy) return;
    const target = flipTargets(view.cards, view.id)[dir];
    if (!target) return;
    busy = true;
    renderHead();
    const result = await loadAndShow(target);
    busy = false;
    if (!view) return;
    if (result.missing) { await leave(); return; }
    if (result.shown) {
        view.id = target;
        view.name = result.name;
        closeShade();
        window.scrollTo(0, 0);
    }
    renderHead();
}

// «← Группа» и Esc: свой персонаж — из памяти; экран «Кампании» на той же кампании (он сам
// загружает свежие карточки). Своего открыто не было — пустой лист и окно «Персонажи»
export async function leave() {
    if (!view) return;
    const { campaignId } = view;
    view = null;
    busy = false;
    epoch++;
    document.body.classList.remove('sheet-viewing');
    setViewOnly(null);
    setViewHeight();
    setDestinyView(null);
    if (leaveView()) await openCampaigns({ select: campaignId });
}

// Esc в просмотре, когда не открыто ни панели, ни окна, — «← Группа»
window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !view || isSheetOpen() || byId('incap-overlay')) return;
    if (LAYERS.some(id => !byId(id).classList.contains('hidden'))) return;
    e.stopImmediatePropagation();
    leave();
}, true);
