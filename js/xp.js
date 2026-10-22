import { state } from './state.js';
import { showToast } from './ui-utils.js';
import { updateGeneratorUI } from './character-generator.js';
import { saveSession } from './persistence.js';
import { initTalentTree } from './talent-tree.js';
import { xpSnapshot, restoreXPSnapshot, xpLogEntry } from './xp-history.js';

// change — сама покупка или возврат (изменение statMods/skillRanks/talents): выполняется после
// снимка для «Отменить», чтобы отмена вернула и XP, и купленное
export function applyXP(action, amountOverride = null, desc = "", change = null) {
    const input = document.getElementById('xp-amount-input');
    const val = amountOverride !== null ? amountOverride : (parseInt(input.value) || 0);

    if (val !== 0) {
        state.xpHistory.push(xpSnapshot(state));
        if (change) change();
        if (state.xpHistory.length > 10) state.xpHistory.shift();
        if (action === 'add') { state.xpData.earned += val; showToast(`+${val} XP начислено`, 'success'); }
        else if (action === 'spend') { state.xpData.spent += val; showToast(`-${val} XP потрачено`, 'info'); }
        else if (action === 'buy_talent') { state.xpData.spent += val; showToast(`-${val} XP — Талант`, 'gold'); }
        else if (action === 'buy_skill') { state.xpData.spent += val; showToast(`-${val} XP — ${desc || 'Навык'}`, 'gold'); }
        else if (action === 'buy_stat') { state.xpData.spent += val; showToast(`-${val} XP — ${desc || 'Стат'}`, 'gold'); }
        else if (action === 'refund_talent' || action === 'refund_skill' || action === 'refund_stat') { state.xpData.spent -= val; showToast(`+${val} XP возвращено`, 'info'); }

        if (amountOverride === null && input) input.value = '';
        state.xpLog.unshift(xpLogEntry(action, val, desc)); if (state.xpLog.length > 5) state.xpLog.pop();
        updateGeneratorUI(); saveSession();
    }
}

export function undoLastXP() {
    if (state.xpHistory.length === 0) return;
    Object.assign(state, restoreXPSnapshot(state.xpHistory.pop()));
    updateGeneratorUI(); initTalentTree(); saveSession();
}

