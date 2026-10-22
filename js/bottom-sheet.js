import { classifySwipe } from './hud-math.js';

// Общий механизм панелей «Состояние», «XP», «Сила» (подпроект А2). На телефоне панель выезжает
// снизу, на компьютере — окно по центру (css/style.css, .sheet-overlay). Закрывается «×»,
// тапом по затемнению (onclick в разметке), свайпом вниз по шапке панели ([data-sheet-grab]) и
// Esc. Одновременно открыта одна панель.
const byId = id => document.getElementById(id);
let openId = null;
let returnFocus = null;

export function isSheetOpen() {
    return openId !== null;
}

// locked — окно не закрывают «×», затемнение, свайп и Esc (окно «Персонажи», пока никто не открыт);
// закрыть его может только closeSheet({ force: true })
let locked = false;

export function openSheet(id, { locked: lock = false } = {}) {
    if (openId && openId !== id) closeSheet({ force: true });
    if (openId !== id) returnFocus = document.activeElement;
    byId(id).classList.remove('hidden');
    openId = id;
    locked = lock;
    byId(id).querySelector('[data-sheet-close]')?.classList.toggle('hidden', lock);
    (lock ? byId(id).querySelector('.sheet-body') : byId(id).querySelector('[data-sheet-close]'))?.focus();
}

export function closeSheet({ force = false } = {}) {
    if (!openId || (locked && !force)) return;
    byId(openId).classList.add('hidden');
    openId = null;
    locked = false;
    // Фокус — на кнопку карточки, с которой открыли панель
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
}

let swipeStart = null;
document.addEventListener('pointerdown', (e) => {
    if (!openId || !e.target.closest('[data-sheet-grab]')) return;
    swipeStart = { x: e.clientX, y: e.clientY, t: e.timeStamp };
});
document.addEventListener('pointerup', (e) => {
    if (!swipeStart) return;
    const s = swipeStart;
    swipeStart = null;
    if (classifySwipe({ dx: e.clientX - s.x, dy: e.clientY - s.y, dt: e.timeStamp - s.t }) === 'down') closeSheet();
});
document.addEventListener('pointercancel', () => { swipeStart = null; });

// Esc: слушатель на window в фазе захвата срабатывает раньше шторки (hud-collapse.js импортирует
// этот модуль, поэтому его слушатель зарегистрирован позже) и раньше общего обработчика
// (char-setup-modal.js). Если поверх панели открыто подтверждение — Esc закрывает только его
// (это делает общий обработчик), панель остаётся.
window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !openId) return;
    if (!byId('modal-overlay').classList.contains('hidden') || byId('incap-overlay')) return;
    closeSheet();
    e.stopImmediatePropagation();
}, true);
