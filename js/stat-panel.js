import { state } from './state.js';
import { ALL_SKILLS } from './skills.js';
import { STAT_CONFIG, getDerivedStats, tryBuyStat, tryRefundStat } from './character-generator.js';
import { STAT_ORDER, statInfo } from './stat-info.js';

// Характеристики на листе — лента из шести ячеек; нажатие открывает карточку одной
// характеристики (на телефоне — весь экран, на компьютере — окно по центру). Покупка и
// возврат — прежние tryBuyStat / tryRefundStat с их проверками и подтверждением.
let openKey = null;

const byId = id => document.getElementById(id);
const valueOf = (race, key) => race.stats[key] + (state.statMods[key] || 0);
const isBought = key => (state.statMods[key] || 0) > 0;

function currentRace() {
    const select = byId('gen-race');
    return select ? state.db.races.find(r => r.id === select.value) : null;
}

export function renderStatStrip() {
    const strip = byId('stat-strip');
    if (!strip) return;
    const race = currentRace();
    if (!race) { strip.innerHTML = ''; return; }
    strip.innerHTML = STAT_ORDER.map(key => {
        const conf = STAT_CONFIG[key];
        const value = valueOf(race, key);
        const valueColor = isBought(key) ? 'text-yellow-400 drop-shadow-[0_0_5px_rgb(var(--accent-400)/0.5)]' : 'text-white';
        const border = isBought(key) ? 'border-yellow-500/60' : conf.border;
        return `<button type="button" onclick="openStatPanel('${key}')" aria-label="${conf.t}: ${value}" class="stat-card flex flex-col items-center py-1.5 rounded border bg-slate-900 ${border} active:scale-95">
            <span class="fs-cap uppercase font-black leading-none ${conf.color}" style="letter-spacing:0.04em;">${conf.abbr}</span>
            <span class="fs-num-lg font-black leading-none mt-1 ${valueColor}" style="font-family: var(--sw-font-mono, monospace);">${value}</span>
        </button>`;
    }).join('');
}

export function openStatPanel(key) {
    if (!currentRace()) return;
    openKey = key;
    byId('stat-panel').classList.remove('hidden');
    refreshStatPanel();
    byId('stat-panel-close').focus();
}

export function closeStatPanel() {
    const key = openKey;
    openKey = null;
    byId('stat-panel').classList.add('hidden');
    // Фокус возвращается на ячейку ленты, с которой открыли карточку
    if (key) byId('stat-strip')?.children[STAT_ORDER.indexOf(key)]?.focus();
}

export function selectStat(key) {
    openKey = key;
    refreshStatPanel();
}

function costLine(info, availXP) {
    const race = `раса ${info.raceValue}`;
    if (info.buyBlock === 'max') return `${race} · максимум — 6`;
    const next = `следующий уровень ${info.nextValue} — `;
    if (info.buyBlock === 'xp') return `${race} · ${next}<b class="text-red-400">${info.nextCost} XP</b> · не хватает ${info.shortBy} XP`;
    return `${race} · ${next}<b class="text-yellow-400">${info.nextCost} XP</b> (свободно ${availXP})`;
}

// Перерисовать открытую карточку; вызывается из updateGeneratorUIRaw после любой перерисовки листа
export function refreshStatPanel() {
    if (!openKey) return;
    const race = currentRace();
    const derived = getDerivedStats();
    if (!race || !derived) { closeStatPanel(); return; }

    const key = openKey;
    const conf = STAT_CONFIG[key];
    const availXP = race.startXP + state.xpData.earned - state.xpData.spent;
    // «Световой меч» — от характеристики, выбранной на листе (как в renderSkillRow)
    const skills = ALL_SKILLS.map(s => s.name === 'Световой меч' ? { ...s, char: state.lightsaberChar || 'brawn' } : s);
    const info = statInfo(key, { raceStats: race.stats, statMods: state.statMods, availXP, derived, skills });

    byId('stat-panel-title').textContent = conf.t;

    byId('stat-panel-tabs').innerHTML = STAT_ORDER.map(k => {
        const c = STAT_CONFIG[k];
        const active = k === key;
        return `<button type="button" onclick="selectStat('${k}')" aria-pressed="${active}" class="flex flex-col items-center py-1 rounded border fs-cap font-black uppercase leading-none ${c.color} ${active ? c.activeTab : 'bg-slate-950 border-slate-800'}">${c.abbr}<span class="fs-body mt-0.5 ${isBought(k) ? 'text-yellow-400' : 'text-white'}">${valueOf(race, k)}</span></button>`;
    }).join('');

    const valueEl = byId('stat-panel-value');
    valueEl.textContent = info.value;
    valueEl.className = 'text-6xl font-black leading-none w-16 text-center ' + (info.isModified ? 'text-yellow-400 drop-shadow-[0_0_5px_rgb(var(--accent-400)/0.5)]' : 'text-white');

    // Серая кнопка — только подсказка: проверки и сообщения остаются в tryBuyStat / tryRefundStat
    const minus = byId('stat-panel-minus');
    const plus = byId('stat-panel-plus');
    minus.onclick = () => tryRefundStat(key);
    plus.onclick = () => tryBuyStat(key);
    minus.classList.toggle('opacity-30', !info.canRefund);
    plus.classList.toggle('opacity-30', info.buyBlock !== null);

    byId('stat-panel-cost').innerHTML = costLine(info, availXP);

    byId('stat-panel-affects').classList.toggle('hidden', info.affects.length === 0);
    byId('stat-panel-affects-list').innerHTML = info.affects.map(a => `${a.label} <b class="text-white">${a.value}</b>`).join(' · ');

    byId('stat-panel-skills').textContent = info.skills.join(' · ');
}

// Esc закрывает карточку. Слушатель в фазе захвата срабатывает раньше общего обработчика
// Esc (char-setup-modal.js), который прячет окно подтверждения: если подтверждение открыто
// поверх карточки, Esc закрывает только его.
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !openKey) return;
    const confirmOverlay = byId('modal-overlay');
    if (confirmOverlay && !confirmOverlay.classList.contains('hidden')) return;
    closeStatPanel();
}, true);
