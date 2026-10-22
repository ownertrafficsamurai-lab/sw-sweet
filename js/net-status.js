// Лист только для чтения — по одной из двух причин. «Нет сети» (подпроект 4б): база — единственное
// место хранения; признак — события браузера online / offline; над шапкой полоса #net-banner, у body
// класс read-only — всё, что меняет персонажа, приглушено и не нажимается. «Просмотр» (4.2): мастер
// смотрит лист игрока (party-view.js) — то же не нажимается, но не приглушается (лист должен
// читаться), а о заблокированном нажатии сообщает обратный вызов. Работает просмотр: вкладки,
// прокрутка, сворачивание разделов, панели, раскрытие строк, меню (файл, печать, тема, размер).
const byId = id => document.getElementById(id);

// Что остаётся доступным без сети. Всё остальное на странице — изменение персонажа
const ALLOW = [
    '[data-ro-ok]',                                   // помечено в разметке
    '.sw-tab-btn', '.bnav-btn',                       // вкладки
    '.section-divider',                               // сворачивание разделов
    '[data-sheet-close]', '#stat-panel-close',        // закрытие панелей
    '.stat-card', '#stat-panel-tabs button',          // карточка характеристики (просмотр)
    '.inv-head', '.inv-fold', '.inv-chip',            // раскрытие строки предмета и расшифровка свойства
    'summary',                                        // раскрытие <details> («Справка по символам», базовая сила)
    '#modal-overlay', '#auth-gate', '#app-loading',   // сообщения, вход, экран загрузки
    '#save-failed', '#toast-container',
].join(', ');
// Затемнение окна закрывает его нажатием по самому затемнению (не по содержимому)
const BACKDROPS = '.sheet-overlay, #stat-panel, #char-setup-modal, #hud-dim';
const EVENTS = ['click', 'beforeinput', 'input', 'change', 'keydown'];
const CONTROLS = 'input, select, textarea, button, [role="button"], [contenteditable]';

let offline = false;
// Просмотр листа игрока: обратный вызов на заблокированное нажатие; null — просмотра нет
let viewing = null;
let relaying = false;
let onOnline = () => {};

export function isOffline() {
    return offline;
}

// Просмотр листа игрока (party-view.js): onBlocked — на каждое заблокированное нажатие поля, кнопки
// или того, что выглядит нажимаемым (узел дерева, квадратик ранга); null — просмотр закончен
export function setViewOnly(onBlocked) {
    viewing = onBlocked;
    if (viewing && document.activeElement instanceof HTMLElement && !allowed(document.activeElement)) document.activeElement.blur();
}

function allowed(target) {
    const el = target instanceof Element ? target : target?.parentElement;
    if (!el) return true;
    return !!el.closest(ALLOW) || el.matches(BACKDROPS);
}

// Фаза захвата на document — раньше обработчиков самих кнопок и полей (в том числе onclick в
// разметке). Заблокированное событие дальше не идёт
function guard(e) {
    if ((!offline && !viewing) || relaying || allowed(e.target)) return;
    const el = e.target instanceof Element ? e.target : e.target.parentElement;
    const control = !!el.closest(CONTROLS);
    if (e.type === 'keydown') {
        // Вне полей и кнопок клавиши ничего не меняют (прокрутка страницы); в них проходят только
        // Tab и Esc: Enter и пробел нажали бы кнопку, стрелки изменили бы число или список
        if (!control || e.key === 'Tab' || e.key === 'Escape') return;
    }
    e.stopImmediatePropagation();
    e.preventDefault();
    // Нажатие «мимо» закрывает открытые меню (их слушатели стоят на window и события не увидят)
    if (e.type === 'click') {
        relaying = true;
        try { document.body.click(); } finally { relaying = false; }
    }
    // Нажатие на простой текст ничего не изменило бы — о нём не сообщается
    if (viewing && (control || getComputedStyle(el).cursor === 'pointer')) viewing();
}

function apply() {
    const banner = byId('net-banner');
    document.body.classList.toggle('read-only', offline);
    banner.classList.toggle('hidden', !offline);
    // Высота полосы — отступ страницы, мини-блока и закреплённой шапки (style.css, --net-h)
    document.documentElement.style.setProperty('--net-h', offline ? banner.offsetHeight + 'px' : '0px');
    // Поле, в котором стоял курсор, без сети не редактируется — фокус снимается
    if (offline && document.activeElement instanceof HTMLElement && !allowed(document.activeElement)) document.activeElement.blur();
}

function set(next) {
    if (offline === next) return;
    offline = next;
    apply();
    if (!offline) onOnline();
}

// handler — что сделать, когда сеть вернулась (дописать несохранённое)
export function initNetStatus(handler) {
    onOnline = handler;
    // Правило приглушения — из того же списка, что и блокировка: один источник
    const style = document.createElement('style');
    // Всё нажимаемое (и квадратики рангов с onclick) — кроме разрешённого и затемнений окон
    // Многострочные поля (заметки) не приглушаются и прокручиваются — их только читают: ввод гасит guard
    style.textContent = `body.read-only :is(button, input, select, [role="button"], [onclick]):not(:is(${ALLOW}), :is(${ALLOW}) *, ${BACKDROPS}) { opacity: .4; pointer-events: none; }`;
    document.head.append(style);
    for (const type of EVENTS) document.addEventListener(type, guard, true);
    window.addEventListener('offline', () => set(true));
    window.addEventListener('online', () => set(false));
    set(navigator.onLine === false);
}
