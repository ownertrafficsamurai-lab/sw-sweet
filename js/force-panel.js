import { state } from './state.js';
import { openSheet } from './bottom-sheet.js';
import { moralityStatus, FORCE_RATING_MAX } from './hud-math.js';
import { updateForce, updateMorality } from './character-generator.js';
import { saveSession } from './persistence.js';

// Панель «Сила» (подпроект А2): рейтинг Силы (прежний updateForce, «+» неактивна на 10 — граница
// прежнего поля) и мораль (прежний updateMorality с его ограничением 1–100; подписи и пороги —
// moralityStatus в hud-math.js).
const byId = id => document.getElementById(id);

export function openForcePanel() {
    openSheet('force-panel');
}

export function changeForce(delta) {
    updateForce(Math.min(FORCE_RATING_MAX, Math.max(0, state.forceRating + delta)));
}

export function changeMorality(delta) {
    updateMorality(state.morality + delta);
    saveSession();
}

export function renderForcePanel() {
    byId('fp-force').textContent = state.forceRating;
    byId('fp-force-minus').disabled = state.forceRating <= 0;
    byId('fp-force-plus').disabled = state.forceRating >= FORCE_RATING_MAX;

    byId('fp-morality').textContent = state.morality;
    byId('fp-morality-marker').style.left = `calc(${state.morality}% - 2px)`;
    const status = moralityStatus(state.morality);
    const label = byId('fp-morality-status');
    label.textContent = status.label;
    label.className = 'uppercase font-bold ' + status.cls;
}
