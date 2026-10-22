import { state } from './state.js';
import { openSheet, closeSheet } from './bottom-sheet.js';
import { showAlert, showToast } from './ui-utils.js';
import { openCharSetup } from './char-setup-modal.js';
import { currentRace, raceChoiceContext, updateGeneratorUI } from './character-generator.js';
import { raceBonus, chosenRaceSkills, raceChoiceOptions, canDropRaceSkill, applyRaceChoice } from './race-skills.js';

// Окно выбора расовых навыков (спека 2026-10-01-race-free-skill-ranks.md): у грана и тви'лека —
// один навык из двух, у человека — два любых некарьерных (список всех навыков с поиском). Механизм
// панелей — bottom-sheet.js; открывается поверх «Настройки персонажа». Выбор применяет «Готово»
// (applyRaceChoice в race-skills.js); закрытие окна ничего не меняет. Названия — только textContent.
const byId = id => document.getElementById(id);
const SHEET = 'race-skill-picker';
const BLOCKED = { career: 'К — карьерный', spec: 'С — специализации' };
let draft = [];   // отмеченные навыки до «Готово»

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function openRaceSkillPicker() {
    const race = currentRace();
    if (!raceBonus(race).choose) return;
    draft = chosenRaceSkills(race, state.raceSkills);
    byId('race-skill-picker-search').value = '';
    openSheet(SHEET);
    renderRaceSkillPicker();
    byId('race-skill-picker-list').scrollTop = 0;
}

// Из строки-напоминания над навыками: «Настройка персонажа» и сразу окно выбора
export function openRaceSkillChoice() {
    openCharSetup();
    openRaceSkillPicker();
}

export function renderRaceSkillPicker() {
    const race = currentRace();
    const { choose, from } = raceBonus(race);
    const search = byId('race-skill-picker-search');
    search.classList.toggle('hidden', from !== 'non_career');
    const query = search.value.trim().toLowerCase();
    byId('race-skill-picker-title').textContent = `Расовые навыки · ${draft.length} из ${choose}`;
    const saved = chosenRaceSkills(race, state.raceSkills);
    const rows = raceChoiceOptions(race, raceChoiceContext())
        .filter(option => !query || option.name.toLowerCase().includes(query))
        .map(option => {
            const on = draft.includes(option.name);
            // Сохранённый навык с купленными поверх рангами снять нельзя; ставший карьерным — остаётся доступным
            const locked = saved.includes(option.name) && !canDropRaceSkill(state, option.name);
            const blocked = on ? null : option.blocked;
            const row = el('button', 'race-skill-row');
            row.type = 'button';
            row.dataset.skill = option.name;
            row.setAttribute('aria-pressed', String(on));
            row.disabled = Boolean(blocked) || locked;
            const check = el('span', 'race-skill-check', on ? '✓' : '');
            check.setAttribute('aria-hidden', 'true');
            row.append(check, el('span', 'race-skill-name', option.name));
            if (blocked) row.append(el('span', 'race-skill-note', BLOCKED[blocked]));
            if (locked) row.append(el('span', 'race-skill-note', 'куплены ранги — сначала верните их'));
            row.addEventListener('click', () => toggle(option.name, choose));
            return row;
        });
    const list = byId('race-skill-picker-list');
    list.replaceChildren(...(rows.length ? rows : [el('p', 'picker-empty', 'Ничего не найдено.')]));
    byId('race-skill-picker-done').disabled = draft.length !== choose;
}

// Отметить или снять навык. Когда выбирается один навык — нажатие на другой заменяет выбор
function toggle(name, choose) {
    if (draft.includes(name)) draft = draft.filter(n => n !== name);
    else if (draft.length < choose) draft = [...draft, name];
    else if (choose === 1 && canDropRaceSkill(state, draft[0])) draft = [name];
    else return;
    renderRaceSkillPicker();
    [...byId('race-skill-picker-list').querySelectorAll('.race-skill-row')].find(n => n.dataset.skill === name)?.focus();
}

export function confirmRaceSkillPicker() {
    const result = applyRaceChoice(state, currentRace(), draft, raceChoiceContext());
    if (!result.ok) {
        showAlert(result.reason === 'locked'
            ? `Сначала верните купленные ранги: ${result.locked.join(', ')}.`
            : 'Выбор не подходит: отметьте нужное число доступных навыков.');
        return;
    }
    const refund = state.xpData.spent - result.patch.xpData.spent;
    Object.assign(state, result.patch);
    closeSheet();
    updateGeneratorUI();
    if (refund > 0) showToast(`+${refund} XP возвращено`, 'info');
}
