import { state } from './state.js';
import { getDerivedStats } from './character-generator.js';
import { xpSummary, vitalFill } from './hud-math.js';
import { renderConditionPanel } from './condition-panel.js';
import { renderXPPanel } from './xp-panel.js';
import { renderForcePanel } from './force-panel.js';
import { safeAvatar } from './save-check.js';

// Карточка персонажа (подпроект А2): кто это; XP; поглощение, Сила, раны, усталость; ряд
// характеристик (#stat-strip рисует stat-panel.js). Разметка одна; где она — решает hud-place.js,
// как выглядит — css/style.css: на телефоне ярусами в шапке, на компьютере — в боковой панели
// «Листа» и «Способностей» или компактной строкой в шапке (А3, часть 2). Здесь же — мини-блок
// (hud-collapse.js показывает его при прокрутке) и содержимое трёх панелей. Вызывается из
// updateGeneratorUIRaw после любой перерисовки листа, из updateForce, updateAvatarUI и при вводе имени.
const byId = id => document.getElementById(id);
const setText = (id, text) => { const el = byId(id); if (el) el.textContent = text; };

function currentRace() {
    const select = byId('gen-race');
    return select ? state.db.races.find(r => r.id === select.value) : null;
}

export function characterName() {
    return byId('char-name').value.trim() || 'Без имени';
}

function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function renderVital(type, current, max) {
    const id = type === 'wounds' ? 'hud-wounds' : 'hud-strain';
    const fill = byId(id + '-fill');
    if (max === null) {
        setText(id, '—');
        setText(id + '-max', '');
        fill.style.width = '0%';
        setText('hud-mini-' + type, '—');
        return;
    }
    const { pct, color } = vitalFill(type, current, max);
    setText(id, current);
    setText(id + '-max', '/' + max);
    fill.style.width = pct + '%';
    fill.style.background = color;
    setText('hud-mini-' + type, `${current}/${max}`);
}

export function renderHudCard() {
    const race = currentRace();
    const derived = getDerivedStats();
    const name = characterName();
    setText('hud-name', name);
    setText('hud-mini-name', name);
    const miniAvatar = byId('hud-mini-avatar');
    if (miniAvatar) {
        const avatar = safeAvatar(state.charAvatar);
        miniAvatar.style.backgroundImage = avatar ? `url(${avatar})` : '';
        miniAvatar.textContent = avatar ? '' : initials(name);
    }

    const xp = xpSummary({ startXP: race ? race.startXP : 0, earned: state.xpData.earned, spent: state.xpData.spent });
    setText('hud-xp-free', xp.free);
    byId('hud-xp-fill').style.width = xp.pct + '%';
    setText('hud-xp-text', `потрачено ${xp.spent} из ${xp.total}`);

    setText('hud-soak', derived ? derived.soak : '—');
    // «ЗАЩ N» под «ПОГЛ.» — когда надетая броня даёт защиту (подпроект Б1)
    const defense = derived ? derived.defense : 0;
    setText('hud-def', `ЗАЩ ${defense}`);
    byId('hud-def').classList.toggle('hidden', !(defense > 0));
    setText('hud-force', state.forceRating);
    renderVital('wounds', state.currentStatus.wounds, derived ? derived.maxWounds : null);
    renderVital('strain', state.currentStatus.strain, derived ? derived.maxStrain : null);

    renderConditionPanel(derived);
    renderXPPanel(xp);
    renderForcePanel();
}
