import { state } from './state.js';
import { TALENTS_DB, FORCE_DB, FORCE_LIST } from './reference-data.js';
import { collectAbilities, toggleUsed } from './abilities.js';
import { formatDesc } from './ui-utils.js';
import { saveSession } from './persistence.js';

// Вкладка «Способности» (спека 2026-09-30-abilities-tab.md, раздел 2): разделы «Активные»,
// «Пассивные», «Сила». Данные собирает abilities.js; здесь — разметка, отметка «использован» у
// активных талантов и раскрытые описания базовых сил.
const byId = id => document.getElementById(id);
const SECTIONS = ['active', 'passive', 'force'];

// Раскрытые описания базовых сил (id сил): перерисовка вкладки их не закрывает. Живёт до
// перезагрузки страницы, в сохранение не попадает.
const openForce = new Set();

export function renderAbilities() {
    if (!byId('abil-active-list')) return;
    const data = collectAbilities({
        purchased: state.purchasedTalents, talentTrees: TALENTS_DB, forceTrees: FORCE_DB, forceList: FORCE_LIST,
    });
    byId('abil-active-list').replaceChildren(...data.active.map(activeTile));
    byId('abil-passive-list').replaceChildren(...data.passive.map(passiveTile));
    byId('abil-force-list').replaceChildren(...data.force.map(forceCard));
    // Пустой раздел скрыт целиком, с заголовком; число — в своём <span>, текст заголовка (ключ
    // сворачивания, ui-utils.js) не меняется
    for (const key of SECTIONS) {
        byId(`abil-${key}-count`).textContent = data[key].length;
        byId(`abil-${key}`).hidden = !data[key].length;
    }
    byId('abil-empty').hidden = SECTIONS.some(key => data[key].length);
}

// Нажатие на плитку активного таланта (раздел 3.3); плитки рисуются заново — фокус возвращается
// на нажатую, чтобы клавиатура не теряла место
export function toggleTalentUse(ids) {
    state.usedTalents = toggleUsed(state.usedTalents, ids);
    renderAbilities();
    saveSession();
    [...byId('abil-active-list').children].find(el => el.dataset.talent === ids[0])?.focus();
}

const chip = text => `<span class="abil-chip">${text}</span>`;
const chips = ({ rank, tiers }) =>
    (rank > 1 ? `<span class="bg-yellow-600 text-on-accent fs-cap px-1.5 py-0.5 rounded-[2px] font-black shadow-sm whitespace-nowrap">Ранг ${rank}</span>` : '')
    + tiers.map(t => chip(`Тир ${t}`)).join('');
const desc = text => `<div class="fs-small leading-snug w-full font-sans text-slate-400 hyphens-auto break-words">${formatDesc(text)}</div>`;

function activeTile(tile) {
    const used = tile.ids.some(id => state.usedTalents.includes(id));
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.talent = tile.ids[0];
    el.setAttribute('aria-pressed', String(used));
    el.className = 'abil-tile flex flex-col text-left p-1.5 rounded border transition-all duration-200 group relative overflow-hidden '
        + (used ? 'bg-slate-950 border-slate-800 text-slate-600 grayscale opacity-60'
            : 'bg-slate-900 border-slate-700 hover:border-yellow-500 text-slate-300 hover:text-white shadow-lg shadow-black/20');
    // Название переносится (а не обрезается многоточием), описание — целиком (А3)
    el.innerHTML = `
        <div class="flex justify-between items-start gap-1 w-full">
            <span class="fs-cap font-bold uppercase tracking-[0.04em] text-yellow-500 group-hover:text-yellow-400 min-w-0 hyphens-auto break-words">${tile.name}</span>
            <span class="fs-cap opacity-60 font-mono flex-shrink-0" aria-hidden="true">${used ? '✕' : '⚡'}</span>
        </div>
        <div class="flex flex-wrap items-center gap-1 my-1">${chips(tile)}</div>
        ${desc(tile.desc)}
        ${used ? '<div class="absolute inset-0 bg-black/10 pointer-events-none"></div>' : ''}`;
    el.addEventListener('click', () => toggleTalentUse(tile.ids));
    return el;
}

// Пассивный талант — не кнопка: нажатие ничего не делает, в порядок Tab не входит
function passiveTile(tile) {
    const el = document.createElement('div');
    el.className = 'abil-passive flex flex-col p-1.5 rounded border';
    el.innerHTML = `
        <span class="fs-cap font-bold uppercase tracking-[0.04em] text-slate-200 min-w-0 hyphens-auto break-words">${tile.name}</span>
        <div class="flex flex-wrap items-center gap-1 my-1">${chips(tile)}</div>
        ${desc(tile.desc)}`;
    return el;
}

function forceCard(card) {
    const el = document.createElement('div');
    el.className = 'abil-force';
    const upgrades = card.upgrades.map(u => `
        <div>
            <div class="flex flex-wrap items-center gap-1">
                <span class="abil-upgrade-name">${u.name}${u.count > 1 ? ` ×${u.count}` : ''}</span>
                ${u.tiers.map(t => chip(`Тир ${t}`)).join('')}${u.passive ? '<span class="abil-chip abil-chip-kind">пассивное</span>' : ''}
            </div>
            ${desc(u.desc)}
        </div>`).join('');
    el.innerHTML = `
        <div class="flex flex-wrap justify-between items-baseline gap-x-2">
            <span class="abil-force-name">${card.name}</span>
            <span class="fs-cap text-slate-400 whitespace-nowrap">${card.baseBought ? `Тир 1 · ${card.baseCost} XP` : 'база не куплена'}</span>
        </div>
        <details class="abil-force-base">
            <summary>Описание базовой способности</summary>
            ${desc(card.baseDesc)}
        </details>
        ${upgrades ? `<div class="abil-upgrades">${upgrades}</div>` : ''}`;
    const details = el.querySelector('details');
    details.open = openForce.has(card.id);
    details.addEventListener('toggle', () => { if (details.open) openForce.add(card.id); else openForce.delete(card.id); });
    return el;
}
