import { state } from './state.js';
import { showAlert, showConfirm, showToast } from './ui-utils.js';
import { updateAvatarUI } from './avatar.js';
import { updateSpecsAndUI, updateForceTabs, updateSpec2Tab, updateMorality, updateGeneratorUI } from './character-generator.js';
import { upgradeSave } from './skill-discount.js';
import { initTalentTree } from './talent-tree.js';
import { renderObligations } from './obligations.js';
import { renderInventory } from './inventory-equipment.js';
import { SESSION_VERSION, checkSave, LIMITS } from './save-check.js';
import { FORCE_LIST } from './reference-data.js';
import { queueSave } from './character-session.js';

// Справочники для проверки сохранения (save-check.js)
export const saveReference = () => ({ races: state.db.races, careers: state.db.careers, forcePowers: FORCE_LIST.map(p => p.id) });

// Текст сохранения → результат checkSave; то, что не разбирается как JSON, — не персонаж
export function checkSaveText(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = undefined; }
    return checkSave(parsed, saveReference());
}

// Строки крит. ранений собираются через createElement: текст ранения — ввод пользователя и
// попадает на экран только свойством value
export function renderCrits() {
    const list = document.getElementById('crit-list'); const emptyMsg = document.getElementById('crit-empty');
    if (!list) return;
    list.replaceChildren();
    if (emptyMsg) emptyMsg.classList.toggle('hidden', state.criticalInjuries.length > 0);
    state.criticalInjuries.forEach((crit, index) => {
        const row = document.createElement('div');
        row.className = "flex items-center gap-1 animate-fade-in";
        const input = document.createElement('input');
        input.type = 'text';
        input.className = "w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 fs-small text-red-300 placeholder-slate-400 focus:border-red-500 outline-none";
        input.placeholder = 'd100 эффект...';
        input.maxLength = LIMITS.crit;
        input.value = crit;
        input.addEventListener('change', () => updateCrit(index, input.value));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = "text-slate-600 hover:text-red-500 font-bold px-1";
        remove.textContent = '×';
        remove.addEventListener('click', () => removeCrit(index));
        row.append(input, remove);
        list.appendChild(row);
    });
}

export function addCrit() { if (state.criticalInjuries.length >= 4) { showAlert("Максимум 4 критических ранения!"); return; } state.criticalInjuries.push(""); renderCrits(); saveSession(); }

export function updateCrit(i, t) { state.criticalInjuries[i] = t; saveSession(); }

export function removeCrit(i) { showConfirm("Исцелить критическое ранение?", () => { state.criticalInjuries.splice(i, 1); renderCrits(); saveSession(); }); }

// Персонаж в форме сохранения — из состояния и полей листа
export function currentSession() {
    return {
        charName: document.getElementById('char-name').value,
        raceVal: document.getElementById('gen-race').value,
        careerVal: document.getElementById('gen-career').value,
        specVal: document.getElementById('gen-spec').value,
        forceP1: document.getElementById('force-p1').value,
        forceP2: document.getElementById('force-p2').value,
        charAvatar: state.charAvatar, forceRating: state.forceRating, criticalInjuries: state.criticalInjuries,
        statMods: state.statMods, thresholdMods: state.thresholdMods, currentStatus: state.currentStatus,
        purchasedTalents: state.purchasedTalents,
        xpData: state.xpData, xpHistory: state.xpHistory, xpLog: state.xpLog, skillRanks: state.skillRanks, morality: state.morality,
        selectedCareerSkills: state.selectedCareerSkills,
        raceSkills: state.raceSkills,
playerNotes: document.getElementById('player-notes').value,
usedTalents: state.usedTalents,lightsaberChar: state.lightsaberChar,
        obligations: state.obligations,
        inventory: state.inventory,
        spec2Val: document.getElementById('gen-spec2') ? document.getElementById('gen-spec2').value : 'none',
        _version: SESSION_VERSION,
    };
}

// Правка листа — в очередь записи в базу (character-session.js: пауза, проверка, версия)
export function saveSession() {
    if (!state.isSaveReady) return;
    queueSave(JSON.stringify(currentSession()));
}

// Проверенное сохранение (save-check.js) → состояние и поля листа. Все поля s есть и нужного типа
function applySave(s) {
    // Пустое имя остаётся пустым: в поле — подсказка, в карточке и списке — «Без имени»
    document.getElementById('char-name').value = s.charName;
    state.charAvatar = s.charAvatar;
    updateAvatarUI();
    state.forceRating = s.forceRating;
    state.criticalInjuries = s.criticalInjuries;
    renderCrits();
    const raceSel = document.getElementById('gen-race');
    raceSel.value = s.raceVal;
    // Раса «до смены» — загруженная (requestRaceChange сверяется с ней)
    raceSel.dataset.committed = raceSel.value;
    document.getElementById('gen-career').value = s.careerVal;
    updateSpecsAndUI();
    document.getElementById('gen-spec').value = s.specVal;
    document.getElementById('force-p1').value = s.forceP1;
    document.getElementById('force-p2').value = s.forceP2;
    updateForceTabs();
    state.statMods = s.statMods;
    state.thresholdMods = s.thresholdMods;
    state.currentStatus = s.currentStatus;
    state.xpData = s.xpData;
    state.xpHistory = s.xpHistory;
    state.xpLog = s.xpLog;
    state.skillRanks = s.skillRanks;
    state.purchasedTalents = s.purchasedTalents;
    state.selectedCareerSkills = s.selectedCareerSkills;
    state.raceSkills = s.raceSkills;
    state.usedTalents = s.usedTalents;
    state.playerNotes = s.playerNotes;
    document.getElementById('player-notes').value = s.playerNotes;
    state.lightsaberChar = s.lightsaberChar;
    state.obligations = s.obligations;
    renderObligations();
    state.inventory = s.inventory;
    const credEl = document.getElementById('inv-credits');
    if (credEl) credEl.value = s.inventory.credits;
    renderInventory();
    document.getElementById('gen-spec2').value = s.spec2Val;
    updateSpec2Tab();
}

// Результат checkSave (ok: true) → лист. Сохранение до версии 6: фиксированные расовые навыки
// получают ранг 1 или возврат цены первого ранга; старый цереанин — разницу XP за Знания; флажки
// скидки обрезаются до допустимых — skill-discount.js upgradeSave (вызывающий сразу пишет персонажа
// в базу). Возвращает true, если сохранение изменилось. Пока лист заполняется, правки не сохраняются
export function showSave(result) {
    const ready = upgradeSave(result, raceOf(result.save), skillListsOf(result.save));
    state.isSaveReady = false;
    try {
        applySave(ready.save);
        updateMorality(ready.save.morality);
        updateGeneratorUI();
        initTalentTree();
    } catch (e) { console.error('Error loading:', e); } finally { state.isSaveReady = true; }
    return ready !== result;
}

// Раса сохранения из справочника; нет такой — null
export const raceOf = save => state.db.races.find(r => r.id === save.raceVal) ?? null;

// Карьерные навыки карьеры и бонусные навыки основной специализации сохранения — для флажков скидки
export function skillListsOf(save) {
    const career = state.db.careers.find(c => c.id === save.careerVal);
    const spec = career?.specializations.find(s => s.id === save.specVal);
    return { careerSkills: career?.careerSkills ?? [], specSkills: spec?.bonusSkills ?? [] };
}

export function startNewSession() {
    showConfirm("Начать новую сессию?\n\nРаны, Усталость и использованные таланты будут сброшены. Прокачка и XP сохранятся.", () => {
        state.currentStatus = { wounds: 0, strain: 0 };
        state.usedTalents = [];
        updateGeneratorUI();
        saveSession();
        showToast('Сессия начата! Удачи за столом', 'gold');
    });
}

// Текст файла персонажа: то, что сейчас на листе, прошедшее проверку (save-check.js) — файл всегда
// текущей версии и чистый. Берётся из состояния: несохранённая правка (нет сети) тоже попадает в файл
export function characterFileText() {
    return JSON.stringify(checkSave(currentSession(), saveReference()).save ?? {}, null, 2);
}

// Имя файла персонажа: swrpg_<имя><suffix>.json — только буквы, цифры и подчёркивания
export function fileName(charName, suffix = '') {
    const safeName = String(charName || 'character').replace(/[^\wа-яА-ЯёЁ\s]/g, '').trim().replace(/\s+/g, '_') || 'character';
    return `swrpg_${safeName}${suffix}.json`;
}

export function downloadText(name, text) {
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(text);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export function saveCharacter() {
    downloadText(fileName(document.getElementById('char-name').value), characterFileText());
    showToast('Персонаж сохранён', 'success');
}
