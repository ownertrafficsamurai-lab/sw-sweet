import { state } from './state.js';
import { getDerivedStats } from './character-generator.js';
import { openSheet, closeSheet } from './bottom-sheet.js';
import { switchTab } from './ui-utils.js';

// Панель «Состояние» (подпроект А2): раны и усталость (±1, ±3, порог), строка поглощения и защиты
// от надетой брони инвентаря (подпроект Б1; «→ Снаряжение» ведёт на вкладку) и критические
// ранения (#crit-list — persistence.js). Кнопки вызывают прежние modifyCurrent / modifyThreshold /
// addCrit через мосты window (main.js).
const setText = (id, text) => { document.getElementById(id).textContent = text; };

export function openConditionPanel() {
    // Без расы порогов нет — нажатия на щит, раны и усталость ничего не открывают
    if (!getDerivedStats()) return;
    openSheet('condition-panel');
}

// «→ Снаряжение»: панель закрывается, открывается вкладка «Снаряжение» с начала
export function openEquipmentFromPanel() {
    closeSheet();
    switchTab('equipment');
    window.scrollTo(0, 0);
}

export function renderConditionPanel(derived) {
    if (!derived) return;
    setText('cp-wounds', state.currentStatus.wounds);
    setText('cp-wounds-max', derived.maxWounds);
    setText('cp-wounds-thr', derived.maxWounds);
    setText('cp-strain', state.currentStatus.strain);
    setText('cp-strain-max', derived.maxStrain);
    setText('cp-strain-thr', derived.maxStrain);
    renderSoakLine(derived);
}

// «Поглощение 4 = Физ. сила 3 + броня 1 · Защита 1 · Бронированная одежда» или «Поглощение 3 =
// Физ. сила 3 · брони нет». Название брони может быть вводом пользователя — только текстом
function renderSoakLine(derived) {
    const num = n => { const b = document.createElement('b'); b.className = 'hud-num'; b.textContent = n; return b; };
    const parts = ['Поглощение ', num(derived.soak), ' = Физ. сила ', num(derived.finalStats.brawn)];
    if (derived.armor) parts.push(' + броня ', num(derived.armor.soak), ' · Защита ', num(derived.defense), ' · ', derived.armor.name || 'Без названия');
    else parts.push(' · брони нет');
    document.getElementById('cp-soak-line').replaceChildren(...parts);
}
