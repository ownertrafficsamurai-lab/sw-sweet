// ========== IMPORTS ==========
import { state } from './state.js';
import { FORCE_LIST, CATALOG, TALENTS_DB } from './reference-data.js';
import { ALL_SKILLS, skillTable, skillPool } from './skills.js';
import { sheetStats } from './sheet-stats.js';
import { showAlert, showConfirm, filterSkills } from './ui-utils.js';
import { DESKTOP_QUERY } from './hud-math.js';
import { initTalentTree } from './talent-tree.js';
import { renderAbilities } from './abilities-tab.js';
import { applyXP } from './xp.js';
import { saveSession } from './persistence.js';
import { updateEncumbrance } from './inventory-equipment.js';
import { updateCharInfoDisplay } from './char-setup-modal.js';
import { renderStatStrip, refreshStatPanel } from './stat-panel.js';
import { raceChangeResetsProgress, resetForRaceChange } from './race-change.js';
import { raceBonus, raceSkillNames, grantRaceSkills, needsRaceChoice, raceChoiceLabel, isRaceCheap } from './race-skills.js';
import { discountContext, flagKind, canAddFlag, flagSummary, rankCost, trimFlags } from './skill-discount.js';
import { specRefund, resetForSpecChange, specChangeMessage } from './spec-change.js';
import { findSpec } from './choice-model.js';
import { renderHudCard } from './hud-card.js';
import { renderForcePanel } from './force-panel.js';

// ========== STEP 1: REFERENCE CONFIG ==========
// ALL_SKILLS и COMBAT_SKILLS_LIST — в skills.js (словарь навыков из базы)

// Цвета подписей характеристик — оттенки -400: на ступень светлее ради контраста (подпроект А3)
export const STAT_CONFIG = {
    brawn: { t: "Физ. сила", abbr: "СИЛ", color: "text-red-400", border: "border-red-900/50", bg: "bg-red-950/10", activeTab: "border-red-500 bg-red-500/10" },
    agility: { t: "Ловкость", abbr: "ЛОВ", color: "text-green-400", border: "border-green-900/50", bg: "bg-green-950/10", activeTab: "border-green-500 bg-green-500/10" },
    intellect: { t: "Интеллект", abbr: "ИНТ", color: "text-blue-400", border: "border-blue-900/50", bg: "bg-blue-950/10", activeTab: "border-blue-500 bg-blue-500/10" },
    cunning: { t: "Смекалка", abbr: "СМК", color: "text-game-yellow-400", border: "border-game-yellow-900/50", bg: "bg-game-yellow-950/10", activeTab: "border-game-yellow-500 bg-game-yellow-500/10" },
    willpower: { t: "Воля", abbr: "ВОЛ", color: "text-purple-400", border: "border-purple-900/50", bg: "bg-purple-950/10", activeTab: "border-purple-500 bg-purple-500/10" },
    presence: { t: "Харизма", abbr: "ОБА", color: "text-orange-400", border: "border-orange-900/50", bg: "bg-orange-950/10", activeTab: "border-orange-500 bg-orange-500/10" }
};

// Пункты выбора характеристики светового меча (строка «Световой меч», renderSkillRow)
const LIGHTSABER_CHARS = [
    ['brawn', 'Сила'], ['agility', 'Ловкость'], ['intellect', 'Интеллект'],
    ['cunning', 'Смекалка'], ['willpower', 'Воля'], ['presence', 'Харизма'],
];

// ========== STEP 2: GENERATOR-SETUP AND FORCE/SPEC-TAB FUNCTIONS ==========
export function initGenerator() {
    const raceSel = document.getElementById('gen-race');
    const careerSel = document.getElementById('gen-career');
    const prevRace = raceSel.value; const prevCareer = careerSel.value;
    raceSel.innerHTML = ""; careerSel.innerHTML = "";
    state.db.races.forEach(r => { const opt = document.createElement('option'); opt.value = r.id; opt.textContent = r.name; raceSel.appendChild(opt); });
    state.db.careers.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; careerSel.appendChild(opt); });
    if(prevRace && state.db.races.find(r=>r.id===prevRace)) raceSel.value = prevRace;
    if(prevCareer && state.db.careers.find(c=>c.id===prevCareer)) careerSel.value = prevCareer;
    // Раса до события change (к нему в списке уже новая) — чтобы вернуть её, пока ждём подтверждения
    raceSel.dataset.committed = raceSel.value;
    raceSel.onfocus = () => { raceSel.dataset.committed = raceSel.value; };
    raceSel.onchange = changeRace;
    updateSpecsAndUI();
// Заполняем списки Силы
const f1 = document.getElementById('force-p1');
const f2 = document.getElementById('force-p2');
f1.innerHTML = ""; f2.innerHTML = "";

FORCE_LIST.forEach(p => {
    f1.add(new Option(p.name, p.id));
    f2.add(new Option(p.name, p.id));
});
}

export function updateForceTabs() {
    const p1 = document.getElementById('force-p1').value;
    const p2 = document.getElementById('force-p2').value;
    const btn1 = document.getElementById('btn-tree-f1');
    const btn2 = document.getElementById('btn-tree-f2');

    if (p1 && p1 !== 'none') {
        btn1.classList.remove('hidden');
        // Используем опциональную цепочку (?.) на случай ошибок
        const forceItem = FORCE_LIST.find(x => x.id === p1);
        btn1.textContent = forceItem ? forceItem.name : "Сила 1";
    } else {
        btn1.classList.add('hidden');
        if (state.currentTreeMode === 'force1') switchTreeMode('spec');
    }

    if (p2 && p2 !== 'none') {
        btn2.classList.remove('hidden');
        const forceItem = FORCE_LIST.find(x => x.id === p2);
        btn2.textContent = forceItem ? forceItem.name : "Сила 2";
    } else {
        btn2.classList.add('hidden');
        if (state.currentTreeMode === 'force2') switchTreeMode('spec');
    }
}

export function switchTreeMode(mode) {
    state.currentTreeMode = mode;

    // Обновляем стили кнопок. Видимость не трогаем: вкладку без второй специализации или способности
    // Силы скрывают updateSpec2Tab / updateForceTabs, и клик по другой вкладке её не показывает
    const TREE_TAB_BUTTONS = { spec: 'btn-tree-spec', spec2: 'btn-tree-spec2', force1: 'btn-tree-f1', force2: 'btn-tree-f2' };
    Object.entries(TREE_TAB_BUTTONS).forEach(([m, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const hidden = btn.classList.contains('hidden');
        if (m === mode) {
            btn.className = "px-3 py-1.5 rounded fs-cap font-bold uppercase transition bg-yellow-600 text-on-accent shadow-lg border border-yellow-500";
        } else {
            btn.className = "px-3 py-1.5 rounded fs-cap font-bold uppercase transition bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white";
        }
        btn.classList.toggle('hidden', hidden);
    });

    initTalentTree(); // Перерисовываем дерево
}

export function updateSpec2Tab() {
    const spec2Sel = document.getElementById('gen-spec2');
    const btn = document.getElementById('btn-tree-spec2');
    if (!btn || !spec2Sel) return;
    const val = spec2Sel.value;
    if (val && val !== 'none') {
        btn.classList.remove('hidden');
        let specName = val;
        state.db.careers.forEach(c => {
            const s = c.specializations.find(sp => sp.id === val);
            if (s) specName = s.name;
        });
        btn.textContent = specName;
    } else {
        btn.classList.add('hidden');
        if (state.currentTreeMode === 'spec2') switchTreeMode('spec');
    }
}

// Раса персонажа из справочника (null — не найдена)
export function currentRace() {
    return state.db.races.find(r => r.id === document.getElementById('gen-race').value) ?? null;
}

// Карьерные навыки карьеры и бонусные навыки основной специализации — для выбора «некарьерных»
// расовых навыков (race-skills.js)
export function raceChoiceContext() {
    const career = state.db.careers.find(c => c.id === document.getElementById('gen-career').value);
    const spec = career?.specializations.find(s => s.id === document.getElementById('gen-spec').value);
    return { careerSkills: career?.careerSkills ?? [], specSkills: spec?.bonusSkills ?? [] };
}

// Флажки скидки по текущим расе, карьере и основной специализации (skill-discount.js)
export function discountCtx() {
    const { careerSkills, specSkills } = raceChoiceContext();
    return discountContext(currentRace(), careerSkills, specSkills);
}

// Отметки, недопустимые после смены карьеры, специализации или расы, снимаются (trimFlags)
function trimSelectedFlags() {
    state.selectedCareerSkills = trimFlags(state.selectedCareerSkills, discountCtx(), state.skillRanks);
}

// Расовые навыки расы, которая была до события change скрытого списка (в списке уже новая)
function committedRaceSkills() {
    const raceSel = document.getElementById('gen-race');
    const race = state.db.races.find(r => r.id === (raceSel.dataset.committed || raceSel.value));
    return raceSkillNames(race, state.raceSkills);
}

// ========== STEP 3: STAT/THRESHOLD/INCAPACITATION/MORALITY FUNCTIONS ==========
// Смена расы снимает покупки за XP (race-change.js). Если персонажу есть что терять — сначала
// подтверждение, а до ответа в списке остаётся прежняя раса: Esc закрывает диалог без колбэков,
// поэтому отказ любым способом ничего не меняет.
function requestRaceChange(next, onDone) {
    const raceSel = document.getElementById('gen-race');
    const apply = () => {
        raceSel.value = next;
        raceSel.dataset.committed = next;
        Object.assign(state, resetForRaceChange(state));
        // Фиксированные расовые навыки новой расы — сразу ранг 1 (покупок после сброса нет)
        const race = state.db.races.find(r => r.id === next);
        Object.assign(state, grantRaceSkills(state, raceBonus(race).fixed, race));
        trimSelectedFlags();
        updateGeneratorUI();
        initTalentTree();
        if (onDone) onDone();
    };
    if (!raceChangeResetsProgress(state, committedRaceSkills())) { apply(); return; }
    const name = state.db.races.find(r => r.id === next)?.name || next;
    const refund = state.xpData.spent > 0 ? ` Потраченные ${state.xpData.spent} XP вернутся на счёт.` : '';
    showConfirm(`Сменить расу на «${name}»?\n\nВсё купленное за XP будет снято: характеристики, навыки, таланты и улучшения Силы.${refund} Раны, усталость и поправки порогов обнулятся.\n\nОстанутся XP от мастера, мораль, имя, карьера, заметки и снаряжение.`, apply);
}

// Событие change скрытого списка рас (окно выбора его не вызывает — оно идёт через chooseRace)
function changeRace() {
    const raceSel = document.getElementById('gen-race');
    const next = raceSel.value;
    if (raceChangeResetsProgress(state, committedRaceSkills())) raceSel.value = raceSel.dataset.committed;
    requestRaceChange(next);
}

// ── Выбор из окна (choice-picker.js, подпроект 3b). onDone вызывается, когда выбор применён
// (или менять нечего); при отказе в подтверждении не вызывается — окно остаётся открытым.
export function chooseRace(raceId, onDone) {
    if (raceId === document.getElementById('gen-race').value) { if (onDone) onDone(); return; }
    if (!state.db.races.some(r => r.id === raceId)) return;
    requestRaceChange(raceId, onDone);
}

// Карьера и основная специализация применяются вместе. Купленные таланты дерева прежней
// специализации снимаются с возвратом XP (spec-change.js); если они есть — сначала подтверждение.
export function chooseSpec(careerId, specId, onDone) {
    const careerSel = document.getElementById('gen-career');
    const specSel = document.getElementById('gen-spec');
    const prevCareer = careerSel.value;
    const prevSpec = specSel.value;
    if (careerId === prevCareer && specId === prevSpec) { if (onDone) onDone(); return; }
    const career = state.db.careers.find(c => c.id === careerId);
    const spec = career?.specializations.find(s => s.id === specId);
    // Нет в справочнике или уже взята второй — не выбирается
    if (!spec || specId === document.getElementById('gen-spec2').value) return;
    const nodes = specId === prevSpec ? [] : TALENTS_DB[prevSpec];
    const apply = () => {
        Object.assign(state, resetForSpecChange(state, nodes));
        if (careerId !== prevCareer) {
            careerSel.value = careerId;
            fillSpecLists();
        }
        specSel.value = specId;
        trimSelectedFlags();
        updateGeneratorUI();
        initTalentTree();
        if (onDone) onDone();
    };
    const lost = specRefund(state, nodes);
    if (!lost.count) { apply(); return; }
    showConfirm(specChangeMessage({
        kind: careerId !== prevCareer ? 'career' : 'spec',
        careerName: career.name, specName: spec.name,
        oldSpecName: findSpec(state.db.careers, prevSpec)?.spec.name || prevSpec,
        count: lost.count, xp: lost.xp,
    }), apply);
}

// Вторая специализация; specId 'none' — убрать её
export function chooseSpec2(specId, onDone) {
    const spec2Sel = document.getElementById('gen-spec2');
    const prev = spec2Sel.value;
    if (specId === prev) { if (onDone) onDone(); return; }
    const found = specId === 'none' ? null : findSpec(state.db.careers, specId);
    // Нет в справочнике или это основная специализация — не выбирается
    if (specId !== 'none' && (!found || specId === document.getElementById('gen-spec').value)) return;
    const nodes = TALENTS_DB[prev];
    const apply = () => {
        Object.assign(state, resetForSpecChange(state, nodes));
        spec2Sel.value = specId;
        updateSpec2Tab();
        updateGeneratorUI();
        initTalentTree();
        if (onDone) onDone();
    };
    const lost = specRefund(state, nodes);
    if (!lost.count) { apply(); return; }
    showConfirm(specChangeMessage({
        kind: found ? 'spec2' : 'spec2-remove',
        specName: found?.spec.name,
        oldSpecName: findSpec(state.db.careers, prev)?.spec.name || prev,
        count: lost.count, xp: lost.xp,
    }), apply);
}

// Подписи полей-кнопок «Настройки персонажа»: название выбранного в скрытых списках
function renderSetupFields() {
    const value = id => document.getElementById(id).value;
    const careers = state.db.careers;
    const names = {
        'gen-race': state.db.races.find(r => r.id === value('gen-race'))?.name,
        'gen-career': careers.find(c => c.id === value('gen-career'))?.name,
        'gen-spec': findSpec(careers, value('gen-spec'))?.spec.name,
        'gen-spec2': findSpec(careers, value('gen-spec2'))?.spec.name ?? '— Нет —',
    };
    for (const [id, name] of Object.entries(names)) document.getElementById(id + '-btn-name').textContent = name ?? '—';
    // Поле «Расовые навыки» и напоминание над списком навыков — только у рас с выбором
    const race = currentRace();
    const pending = needsRaceChoice(race, state.raceSkills);
    document.getElementById('race-skills-row').classList.toggle('hidden', !raceBonus(race).choose);
    document.getElementById('race-skills-btn-name').textContent = raceChoiceLabel(race, state.raceSkills);
    document.getElementById('race-skills-btn').classList.toggle('setup-field-warn', pending);
    const reminder = document.getElementById('race-skills-reminder');
    reminder.classList.toggle('hidden', !pending);
    reminder.textContent = pending ? `${race.name}: выберите расовые навыки ›` : '';
}

// Списки специализаций под выбранную карьеру (скрытые #gen-spec и #gen-spec2)
function fillSpecLists() {
    const careerId = document.getElementById('gen-career').value;
    const career = state.db.careers.find(c => c.id === careerId);
    const specSel = document.getElementById('gen-spec');
    specSel.innerHTML = "";
    if (career && career.specializations) {
        career.specializations.forEach(s => { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.name; specSel.appendChild(opt); });
    }
    // Populate spec2 with all specializations from all careers
    const spec2Sel = document.getElementById('gen-spec2');
    if (spec2Sel) {
        const prevSpec2 = spec2Sel.value;
        spec2Sel.innerHTML = '';
        const noneOpt = document.createElement('option'); noneOpt.value = 'none'; noneOpt.textContent = '— Нет —'; spec2Sel.appendChild(noneOpt);
        state.db.careers.forEach(c => { c.specializations.forEach(s => { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.name; spec2Sel.appendChild(opt); }); });
        // Universal specializations
        const univGroup = document.createElement('optgroup'); univGroup.label = '— Универсальные —';
        [{ id: 'emergent', name: 'Пробуждённый к Силе (Emergent)' }, { id: 'exile', name: 'Изгой, чувствующий Силу (Exile)' }, { id: 'recruit', name: 'Рекрут (Recruit)' }].forEach(u => { const opt = document.createElement('option'); opt.value = u.id; opt.textContent = u.name; univGroup.appendChild(opt); });
        spec2Sel.appendChild(univGroup);
        if (prevSpec2 && spec2Sel.querySelector(`option[value="${prevSpec2}"]`)) spec2Sel.value = prevSpec2;
        updateSpec2Tab();
    }
}

export function updateSpecsAndUI() {
    fillSpecLists();
    updateGeneratorUI();
    initTalentTree();
}

export function modifyStat(statKey, delta) {
    const race = state.db.races.find(r => r.id === document.getElementById('gen-race').value);
    if (!race) return;
    const newVal = race.stats[statKey] + (state.statMods[statKey] || 0) + delta;
    if (newVal >= 1 && newVal <= 7) { state.statMods[statKey] = (state.statMods[statKey] || 0) + delta; updateGeneratorUI(); }
}

export function modifyThreshold(type, delta) { state.thresholdMods[type] += delta; updateGeneratorUI(); }

export function modifyCurrent(type, delta) {
    // Порог — та же формула, что у карточки и дашборда мастера (sheet-stats.js). Без расы — прежние
    // значения по умолчанию: база 10 и характеристика 2
    const derived = getDerivedStats();
    const stat = type === 'wounds' ? 'brawn' : 'willpower';
    const maxVal = derived
        ? (type === 'wounds' ? derived.maxWounds : derived.maxStrain)
        : 10 + 2 + (state.statMods[stat] || 0) + (state.thresholdMods[type] || 0);
    const prev = state.currentStatus[type] || 0;
    const next = Math.min(maxVal, Math.max(0, prev + delta));
    state.currentStatus[type] = next;
    // Уведомление при достижении порога
    if (delta > 0 && next >= maxVal && prev < maxVal) {
        if (type === 'wounds') {
            showIncapacitated('wounds');
        } else {
            showIncapacitated('strain');
        }
    }
    saveSession(); updateGeneratorUI();
}

// Производные значения листа (итоговые характеристики, пороги ран/усталости, поглощение и защита)
// — по формуле sheet-stats.js из состояния и полей листа. null — если раса не выбрана.
export function getDerivedStats() {
    return sheetStats({
        raceVal: document.getElementById('gen-race').value,
        statMods: state.statMods, thresholdMods: state.thresholdMods, inventory: state.inventory,
    }, state.db.races, CATALOG);
}

export function showIncapacitated(type) {
    const overlay = document.createElement('div');
    overlay.id = 'incap-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);animation:fadeIn 0.2s ease;';
    const isWounds = type === 'wounds';
    overlay.innerHTML = `
        <div style="text-align:center;padding:2rem;max-width:20rem;animation:scaleIn 0.25s ease;" onclick="this.parentElement.remove()">
            <div style="font-size:3.5rem;line-height:1;margin-bottom:1rem;">${isWounds ? '💀' : '😵'}</div>
            <div style="font-size:1.5rem;font-weight:900;text-transform:uppercase;letter-spacing:0.04em;color:${isWounds ? '#ef4444' : '#f97316'};font-family:'Rajdhani',sans-serif;margin-bottom:0.5rem;">
                ${isWounds ? 'Персонаж без сознания!' : 'Персонаж отключился!'}
            </div>
            <div style="font-size:var(--fs-small);color:#94a3b8;line-height:1.5;margin-bottom:1.5rem;">
                ${isWounds ? 'Порог ран превышен.<br>Критическое ранение + конец раунда.' : 'Порог усталости превышен.<br>Персонаж теряет сознание.'}
            </div>
            <div style="font-size:var(--fs-cap);color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;">Нажмите чтобы закрыть</div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => overlay.remove());
    setTimeout(() => { if (overlay.parentElement) overlay.remove(); }, 6000);
}

// --- MORALITY ---
// Мораль 1–100, как раньше; значение, полоса и подпись — в панели «Сила» (force-panel.js,
// пороги подписи — moralityStatus в hud-math.js)
export function updateMorality(val) {
    state.morality = Math.min(100, Math.max(1, parseInt(val) || 1));
    renderForcePanel();
}

// Рейтинг Силы ≥ 0, как раньше; показывают карточка и панель «Сила»
export function updateForce(val) { state.forceRating = Math.max(0, parseInt(val) || 0); renderHudCard(); saveSession(); }

// ========== STEP 4: SKILL-RANK AND SKILL-ROW-RENDERING FUNCTIONS ==========
export function setSkillRank(skillName, rank) {
    const current = state.skillRanks[skillName] || 0;
    if (current === rank) state.skillRanks[skillName] = 0; else state.skillRanks[skillName] = rank;
    updateGeneratorUI();
}

export function toggleSkillDie(skillName, type) {
    const current = state.skillRanks[skillName] || 0;
    if(type==='green') state.skillRanks[skillName] = current + 1;
    else if(type==='yellow') state.skillRanks[skillName] = Math.max(0, current - 1);
    else if(type==='empty') state.skillRanks[skillName] = current + 1;
    updateGeneratorUI();
}

// Кубики пула: жёлтые (мастерство), затем зелёные (способность). Та же разметка — в строке навыка
// на листе и у оружия на «Снаряжении» (inventory-equipment.js)
export function diceHtml({ yellow, green }) {
    let html = '';
    for(let i=0; i<yellow; i++) html += `<div class="shape-hex w-3.5 h-3.5 bg-[#facc15] border border-[#eab308]" style="box-shadow: 0 0 4px rgba(234,179,8,0.35);"></div>`;
    for(let i=0; i<green; i++) html += `<div class="shape-rhombus w-3.5 h-3.5 bg-[#22c55e] border border-[#16a34a]" style="transform: scale(1.1); box-shadow: 0 0 3px rgba(34,197,94,0.3);"></div>`;
    return html;
}

// ctx — флажки скидки (discountCtx): значки «К» / «С», флажок и значок «Р» у Знаний расы со скидкой
export function renderSkillRow(skill, finalStats, ctx, isRacial = false) {
    const isCareer = ctx.career.has(skill.name);
    const isSpec = ctx.spec.has(skill.name);
    // Характеристика, ранг и кубики — skillPool (skills.js); у светового меча характеристика —
    // выбранная игроком (state.lightsaberChar)
    const pool = skillPool(skill.name, { finalStats, skillRanks: state.skillRanks, lightsaberChar: state.lightsaberChar });
    const effectiveCharKey = pool.charKey;
    const charVal = pool.charVal;
    const rank = pool.rank;

    // Подпись характеристики — сокращение, как в ряду характеристик («ЛОВ (4)», подпроект А3);
    // полное название — в title
    const stat = STAT_CONFIG[effectiveCharKey];
    // У светового меча вместо подписи — выбор характеристики; значение берётся из состояния,
    // так что после загрузки персонажа список показывает сохранённую характеристику
    const charLabel = skill.name === "Световой меч"
        ? `<span class="mt-0.5 flex items-center gap-1 fs-cap text-slate-400">
                <select id="ls-char-select" onchange="setLightsaberChar(this.value)" aria-label="Характеристика светового меча" title="Характеристика светового меча" class="bg-slate-900 border border-red-700 fs-cap rounded text-white focus:outline-none focus:border-red-500 cursor-pointer font-bold uppercase">
                    ${LIGHTSABER_CHARS.map(([key, label]) => `<option value="${key}"${key === effectiveCharKey ? ' selected' : ''}>${label}</option>`).join('')}
                </select>(${charVal})</span>`
        : `<span class="fs-cap text-slate-400 mt-0.5 uppercase" title="${stat.t}">${stat.abbr} (${charVal})</span>`;
    // =============================

    // --- 1. КРАСИВЫЕ ЗНАЧКИ (BADGES) ---
    // Собираем значки в вертикальную стопку слева
    let badgesHtml = `<div class="flex flex-col gap-0.5 items-center justify-center w-5 mr-0.5">`;

    if (isCareer) {
        // Зеленый значок [К]
        badgesHtml += `<div class="career-mark w-4 h-4 flex items-center justify-center rounded-[2px] border border-green-800 bg-green-950 fs-cap leading-none font-black text-green-500 select-none" title="Карьерный навык">К</div>`;
    }

    if (isSpec) {
        // Синий значок [С]
        badgesHtml += `<div class="w-4 h-4 flex items-center justify-center rounded-[2px] border border-blue-800 bg-blue-950 fs-cap leading-none font-black text-blue-500 select-none" title="Навык специализации">С</div>`;
    }
    badgesHtml += `</div>`;

    // --- 2. ФЛАЖОК СКИДКИ (skill-discount.js) ---
    let selectionCheckbox = "";

    // Базовый стиль строки (прозрачный)
    let rowClass = "hover:bg-slate-800/50 transition border-l-2 border-transparent";
    const kind = flagKind(skill.name, ctx);
    const isSelected = kind !== null && state.selectedCareerSkills.includes(skill.name);

    // У Знаний расы со скидкой (цереане) — значок «Р» на месте флажка
    if (isRaceCheap(skill.name, ctx.race)) {
        const label = `${ctx.race.name}: все Знания со скидкой`;
        selectionCheckbox = `<span class="race-cheap-mark" role="img" aria-label="${label}" title="${label}">Р</span>`;
        rowClass = "race-cheap-row border-l-2 hover:bg-slate-800/50 transition";
    }
    // Флажок — у навыков «К» карьеры и «С» основной специализации
    else if (kind !== null) {
        const isDisabled = !isSelected && !canAddFlag(state.selectedCareerSkills, skill.name, ctx);

        // Стиль чекбокса: если выбран — Золотой, если нет — Серый
        const checkBorder = isSelected ? "border-yellow-500 bg-yellow-500" : "border-slate-700 bg-slate-900 group-hover/chk:border-slate-500";
        const checkIcon = isSelected ? `<span class="fs-cap leading-none text-on-accent-bright font-bold">✓</span>` : "";

        selectionCheckbox = `
        <label class="cursor-pointer relative group/chk flex items-center justify-center h-full w-5">
            <input type="checkbox" class="peer sr-only"
                onchange="toggleCareerSelection('${skill.name}')"
                ${isSelected ? 'checked' : ''}
                ${isDisabled ? 'disabled' : ''}>

            <div class="w-4 h-4 border ${isDisabled ? 'opacity-20 cursor-not-allowed' : ''} ${checkBorder} rounded-[2px] flex items-center justify-center transition-all shadow-sm">
                ${checkIcon}
            </div>
        </label>`;

        // Если навык ВЫБРАН ГАЛОЧКОЙ — подсвечиваем строку золотым оттенком
        if (isSelected) {
             rowClass = "bg-yellow-900/10 border-l-2 border-yellow-500 hover:bg-slate-800/50 transition";
        }
        // Если навык специализации (не выбран) — синим, просто карьерный — легкий зеленый оттенок
        else if (isSpec) {
             rowClass = "bg-blue-900/5 border-l-2 border-blue-500 hover:bg-slate-800/50 transition";
        }
        else {
             rowClass = "bg-green-900/5 border-l-2 border-green-900/20 hover:bg-slate-800/50 transition";
        }
    }

    // --- 3. ГЕНЕРАЦИЯ КВАДРАТИКОВ РАНГА ---
    let rankHtml = '<div class="flex gap-0.5">';
    for(let i=1; i<=5; i++) {
        const filled = i <= rank;
        let bg = "rank-empty";
        let cursor = "cursor-default";
        let clickAction = "";
        let title = `Ранг ${i}`;

        // Первый ранг расового навыка — бесплатный: другого цвета, не возвращается
        const fromRace = isRacial && i === 1 && filled;
        if (fromRace) {
            bg = "rank-race";
            title = "Ранг 1 — от расы";
        } else if (filled) {
            bg = "bg-yellow-500 shadow-[0_0_5px_rgb(var(--accent-500)/0.5)] border-yellow-600";
            if (i === rank) {
                cursor = "cursor-pointer hover:bg-red-500 hover:border-red-600 transition-colors";
                clickAction = `onclick="refundSkillRank('${skill.name}', ${i})"`;
                title = "Нажмите для возврата XP";
            }
        } else {
            if (i === rank + 1) {
                cursor = "cursor-pointer hover:bg-slate-600";
                clickAction = `onclick="buySkillRank('${skill.name}', ${i})"`;
                title = "Купить ранг";
            }
        }
        const glowStyle = filled && i === rank && !fromRace ? 'box-shadow: 0 0 4px rgb(var(--accent-500) / .5);' : '';
        const raceAttrs = fromRace ? ' role="img" aria-label="Ранг 1 — от расы"' : '';
        rankHtml += `<div ${clickAction}${raceAttrs} class="rank-box w-2.5 h-3.5 rounded-[1px] border ${bg} ${cursor}" style="${glowStyle}" title="${title}"></div>`;
    }
    rankHtml += '</div>';

    // --- 4. ПУЛ КУБИКОВ ---
    const poolHtml = `<div class="flex gap-0.5 items-center justify-end h-full dice-pool-anim">${diceHtml(pool)}</div>`;

    // Ячейки sk-* — для перестройки строки в две на узком экране (css/style.css, container query skills)
    return `
        <tr class="sk-row ${rowClass}" data-skill="${skill.name.toLowerCase()}">
            <td class="sk-mark py-2 pl-1 pr-0.5 w-[3rem] flex items-center justify-start">
                ${badgesHtml}
                ${selectionCheckbox}
            </td>

            <td class="sk-name py-2 px-1 fs-body font-medium text-slate-300">
                <div class="flex flex-col leading-tight">
                    <span>${skill.name}</span>
                    ${charLabel}
                </div>
            </td>

            <td class="sk-ranks py-2 px-1 w-[4.75rem]">${rankHtml}</td>

            <td class="sk-pool py-2 pl-1 pr-3 w-[7rem] text-right">${poolHtml}</td>
        </tr>
    `;
}

// ========== STEP 5: setLightsaberChar AND updateGeneratorUI WITH MONKEY-PATCH ==========
export function setLightsaberChar(val) {
    state.lightsaberChar = val;
    // Список перерисовывается вместе со строкой навыка — фокус возвращается на новый список
    // (стрелки на закрытом списке меняют значение сразу, без этого фокус терялся бы)
    const hadFocus = document.activeElement?.id === 'ls-char-select';
    updateGeneratorUI(); // Перерисовываем, чтобы обновить кубики
    if (hadFocus) document.getElementById('ls-char-select')?.focus();
    saveSession();
}

function updateGeneratorUIRaw() {
    const race = state.db.races.find(r => r.id === document.getElementById('gen-race').value);
    renderSetupFields();
    if (!race) {
        // Без расы лента пустая, а открытая карточка закрывается (stat-panel.js)
        renderStatStrip();
        refreshStatPanel();
        renderHudCard();
        return;
    }

    const finalStats = {};
    Object.keys(race.stats).forEach(key => { finalStats[key] = race.stats[key] + (state.statMods[key] || 0); });
    // Характеристики — лента и карточка (stat-panel.js)
    renderStatStrip();

    // Три таблицы: на компьютере «Знания» — отдельно, на телефоне — в «Общих» (skills.js skillTable)
    const bodies = {
        general: document.getElementById('gen-skills-general-body'),
        knowledge: document.getElementById('gen-skills-knowledge-body'),
        combat: document.getElementById('gen-skills-combat-body'),
    };
    Object.values(bodies).forEach(tbody => { tbody.innerHTML = ''; });
    const split = window.matchMedia(DESKTOP_QUERY).matches;
    const ctx = discountCtx();
    const racialSkills = new Set(raceSkillNames(race, state.raceSkills));

    ALL_SKILLS.forEach(skill => {
        const html = renderSkillRow(skill, finalStats, ctx, racialSkills.has(skill.name));
        bodies[skillTable(skill.name, split)].innerHTML += html;
    });
    renderDiscountLine(ctx);
    // Строки нарисованы заново — фильтр из поля применяется и к ним
    filterSkills(document.getElementById('skill-filter-input').value);

    // ADDED: Calculate Total Ranks
    const totalRanks = Object.values(state.skillRanks).reduce((a, b) => a + b, 0);
    const ranksDisplay = document.getElementById('total-ranks-display');
    if(ranksDisplay) ranksDisplay.textContent = totalRanks;

    // Update encumbrance max when Brawn changes
    if (typeof updateEncumbrance === 'function') updateEncumbrance();
    // Update char info display in header
    if (typeof updateCharInfoDisplay === 'function') updateCharInfoDisplay();
    // Открытая карточка характеристики показывает новые значения (после покупки/возврата)
    refreshStatPanel();
    // Карточка персонажа, мини-блок и открытые панели (hud-card.js)
    renderHudCard();
}

// Строка над навыками: «Со скидкой: N из M — карьерных до C, специализации до S» (+ «Р» у расы со
// скидкой на Знания). Узлами: числа — в <b>
function renderDiscountLine(ctx) {
    const { used, total, career, spec, cheapKnowledge } = flagSummary(state.selectedCareerSkills, ctx);
    const b = n => Object.assign(document.createElement('b'), { textContent: n });
    const parts = ['Со скидкой: ', b(used), ' из ', b(total), ' — карьерных до ', b(career), ', специализации до ', b(spec)];
    if (cheapKnowledge) {
        const mark = Object.assign(document.createElement('span'), { className: 'race-cheap-mark', textContent: 'Р' });
        mark.setAttribute('aria-hidden', 'true');
        parts.push(' · ', mark, ' все Знания — от расы');
    }
    document.getElementById('skill-discount-line').replaceChildren(...parts);
}

export function updateGeneratorUI() {
    renderAbilities();
    updateGeneratorUIRaw();
    saveSession();
}

// ========== STEP 6: XP-PURCHASE AND MOBILE-TAB-TOGGLE FUNCTIONS ==========
export function toggleCareerSelection(skillName) {
    const index = state.selectedCareerSkills.indexOf(skillName);
    const ctx = discountCtx();
    if (index > -1) {
        state.selectedCareerSkills.splice(index, 1);
    } else if (canAddFlag(state.selectedCareerSkills, skillName, ctx)) {
        state.selectedCareerSkills.push(skillName);
    } else {
        const { total, career, spec } = flagSummary(state.selectedCareerSkills, ctx);
        showAlert(`Навыков со скидкой не больше ${total}: карьерных до ${career}, специализации до ${spec}.`);
    }
    updateGeneratorUI();
    saveSession();
}

// 2. ПОКУПКА ранга (Buy)
export function buySkillRank(skillName, targetRank) {
    const currentRank = state.skillRanks[skillName] || 0;
    if (targetRank !== currentRank + 1) {
        showAlert(`Нужно покупать ранги по очереди! Сначала купите ранг ${currentRank + 1}.`);
        return;
    }
    const cost = rankCost(skillName, targetRank, state.selectedCareerSkills, discountCtx());
    const race = state.db.races.find(r => r.id === document.getElementById('gen-race').value);
    const totalXP = (race ? race.startXP : 0) + state.xpData.earned;
    const availXP = totalXP - state.xpData.spent;
    if (availXP < cost) {
        showAlert(`Недостаточно XP! Нужно ${cost}, у вас ${availXP}.`);
        return;
    }
    showConfirm(`Улучшить навык "${skillName}" до ранга ${targetRank} за ${cost} XP?`, () => {
        applyXP('buy_skill', cost, `Навык ${skillName} ${targetRank}`, () => { state.skillRanks[skillName] = targetRank; });
    });
}

// 3. ВОЗВРАТ ранга (Refund)
export function refundSkillRank(skillName, rankToRefund) {
    const currentRank = state.skillRanks[skillName] || 0;
    if (rankToRefund !== currentRank) return;
    // Первый ранг расового навыка — бесплатный, возвращать нечего (race-skills.js)
    if (rankToRefund === 1 && raceSkillNames(currentRace(), state.raceSkills).includes(skillName)) return;
    const refundAmount = rankCost(skillName, rankToRefund, state.selectedCareerSkills, discountCtx());
    showConfirm(`Вернуть ранг ${rankToRefund} навыка "${skillName}" и получить назад ${refundAmount} XP?`, () => {
        applyXP('refund_skill', refundAmount, `Навык ${skillName} ${rankToRefund}`, () => {
            state.skillRanks[skillName] = currentRank - 1;
            if (state.skillRanks[skillName] === 0) delete state.skillRanks[skillName];
        });
    });
}

export function tryBuyStat(statKey) {
    const race = state.db.races.find(r => r.id === document.getElementById('gen-race').value);
    if (!race) return;
    const currentVal = race.stats[statKey] + (state.statMods[statKey] || 0);
    const nextVal = currentVal + 1;
    if (nextVal > 6) {
        showAlert("Максимальное значение характеристики — 6.");
        return;
    }
    const cost = nextVal * 10;
    const totalXP = race.startXP + state.xpData.earned;
    const availXP = totalXP - state.xpData.spent;
    if (availXP < cost) {
        showAlert(`Недостаточно XP! Для повышения до ${nextVal} нужно ${cost} XP.`);
        return;
    }
    showConfirm(`Повысить ${STAT_CONFIG[statKey].t} до ${nextVal} за ${cost} XP?`, () => {
        applyXP('buy_stat', cost, `${STAT_CONFIG[statKey].t} ${nextVal}`, () => { state.statMods[statKey] = (state.statMods[statKey] || 0) + 1; });
    });
}

// === ВОЗВРАТ ХАРАКТЕРИСТИКИ (ПРОДАЖА) ===
export function tryRefundStat(statKey) {
    const race = state.db.races.find(r => r.id === document.getElementById('gen-race').value);
    if (!race) return;
    const currentMod = state.statMods[statKey] || 0;
    if (currentMod <= 0) {
        showAlert("Нельзя уменьшить характеристику ниже базовой расовой!");
        return;
    }
    const currentVal = race.stats[statKey] + currentMod;
    const refundAmount = currentVal * 10;
    showConfirm(`Понизить ${STAT_CONFIG[statKey].t} до ${currentVal - 1} и вернуть ${refundAmount} XP?`, () => {
        applyXP('refund_stat', refundAmount, `${STAT_CONFIG[statKey].t} ${currentVal}`, () => {
            state.statMods[statKey]--;
            if (state.statMods[statKey] === 0) delete state.statMods[statKey];
        });
    });
}

export function toggleMobileSkills(tab) {
    const viewGen = document.getElementById('view-skills-gen');
    const viewCom = document.getElementById('view-skills-com');
    const btnGen = document.getElementById('tab-btn-gen');
    const btnCom = document.getElementById('tab-btn-com');
    const activeClass = "bg-slate-700 text-white shadow";
    const inactiveClass = "hover:bg-slate-800 text-slate-400";
    if (tab === 'gen') {
        viewGen.classList.remove('hidden'); viewCom.classList.add('hidden');
        if(btnGen) btnGen.className = "flex-1 py-1.5 fs-cap font-bold uppercase rounded transition " + activeClass;
        if(btnCom) btnCom.className = "flex-1 py-1.5 fs-cap font-bold uppercase rounded transition " + inactiveClass;
    } else {
        viewGen.classList.add('hidden'); viewCom.classList.remove('hidden');
        if(btnGen) btnGen.className = "flex-1 py-1.5 fs-cap font-bold uppercase rounded transition " + inactiveClass;
        if(btnCom) btnCom.className = "flex-1 py-1.5 fs-cap font-bold uppercase rounded transition " + activeClass;
    }
}
