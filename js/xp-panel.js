import { state } from './state.js';
import { openSheet } from './bottom-sheet.js';
import { logEntryText } from './hud-math.js';

// Панель XP (подпроект А2): свободно / всего / потрачено, поле суммы и «Получить» / «Потратить»
// (прежний applyXP), «Отменить последнее» (undoLastXP) и история — последние записи state.xpLog,
// новые сверху. Записи выводятся только через textContent: в старых записях и автосейвах лежит
// HTML-разметка, logEntryText оставляет от неё текст.
const byId = id => document.getElementById(id);

export function openXPPanel() {
    openSheet('xp-panel');
}

export function renderXPPanel(xp) {
    byId('xp-free').textContent = xp.free;
    byId('xp-total').textContent = xp.total;
    byId('xp-spent').textContent = xp.spent;
    byId('btn-xp-undo').disabled = state.xpHistory.length === 0;

    const list = byId('xp-history');
    list.replaceChildren();
    if (state.xpLog.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'py-2 text-center text-slate-400 italic';
        empty.textContent = 'Пусто';
        list.appendChild(empty);
        return;
    }
    state.xpLog.forEach(entry => {
        const text = logEntryText(entry);
        const li = document.createElement('li');
        const sign = text.trim()[0];
        li.className = 'hud-num py-1.5 border-b border-slate-800/70 ' + (sign === '+' ? 'text-green-400' : sign === '-' || sign === '−' ? 'text-red-400' : 'text-slate-300');
        li.textContent = text;
        list.appendChild(li);
    });
}
