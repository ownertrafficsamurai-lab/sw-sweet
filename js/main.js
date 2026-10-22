// Step 1: Service worker registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
    });
}

// Step 2: Import every module
import { switchTab, filterSkills, initCollapsibleSections } from './ui-utils.js';
import { setTheme } from './theme.js';
import { setTextSize, toggleTextSizeMenu, closeTextSizeMenu, initTextSize } from './text-size.js';
import { openCharSetup, closeCharSetup, toggleSystemMenu, closeSystemMenu } from './char-setup-modal.js';
import { applyXP, undoLastXP } from './xp.js';
import { handleAvatarClick, uploadAvatar, actionReplace, actionDelete } from './avatar.js';
import { addObligation, renderObligations } from './obligations.js';
import { renderInventory, setCredits } from './inventory-equipment.js';
import { openCatalogPicker, renderPickerList, addOwnFromPicker } from './catalog-picker.js';
import { openChoicePicker, renderChoicePicker, choicePickerBack } from './choice-picker.js';
import { openRaceSkillPicker, openRaceSkillChoice, renderRaceSkillPicker, confirmRaceSkillPicker } from './race-skill-picker.js';
import {
    initGenerator, updateGeneratorUI, updateMorality, updateForce, toggleMobileSkills,
    setLightsaberChar, toggleCareerSelection, refundSkillRank, buySkillRank,
    tryRefundStat, tryBuyStat, modifyThreshold, modifyCurrent, switchTreeMode,
    updateSpec2Tab, updateForceTabs,
} from './character-generator.js';
import { openStatPanel, closeStatPanel, selectStat } from './stat-panel.js';
import { closeSheet } from './bottom-sheet.js';
import { renderHudCard } from './hud-card.js';
import { openConditionPanel, openEquipmentFromPanel } from './condition-panel.js';
import { openXPPanel } from './xp-panel.js';
import { openForcePanel, changeForce, changeMorality } from './force-panel.js';
import { initHudCollapse, openShade, closeShade } from './hud-collapse.js';
import { initHudPlace } from './hud-place.js';
import { saveCharacter, startNewSession, saveSession, addCrit, updateCrit, removeCrit } from './persistence.js';
import { startCharacters, beforeLogout } from './character-session.js';
import { openCharacterList } from './character-list.js';
import { openCampaigns } from './campaigns-screen.js';
import { takeJoinLink, openPendingJoin } from './join-dialog.js';
import { initAuth } from './auth-gate.js';
import { logoutWithTabs } from './logout-flow.js';
import { loadReferenceData } from './reference-data.js';
import { showLoading, showLoadError, loadErrorKind } from './loading-overlay.js';
import { store } from './storage.js';

// Устаревшая локальная копия справочников (бывшая вкладка «База») — больше не читается
store.remove('swrpg_db_v3');

// Ссылка-приглашение ?join=КОД (4.1): код уходит из адреса сразу и ждёт входа в хранилище вкладки
takeJoinLink();

// Кнопки размера текста показывают ступень, выбранную до загрузки (подпроект А3)
initTextSize();

// Step 3: Bootstrap sequence — gated behind a successful auth check. Reference data
// (races, careers, specializations, talent and Force trees) is loaded from Supabase
// first: initGenerator() fills the selects from it, and the character from the database
// (character-session.js) is put into those filled selects — this order matters.
let sheetReady = false;

async function startApp() {
    showLoading();
    try {
        await loadReferenceData();
    } catch (err) {
        console.error('Не удалось загрузить справочники:', err);
        showLoadError(loadErrorKind(err.kind || 'network', navigator.onLine), { onRetry: startApp, onLogout: logoutFromLoading });
        return;
    }
    // «Повторить» после сбоя списка персонажей: лист уже собран
    if (!sheetReady) {
        sheetReady = true;
        initGenerator();
        initHudCollapse();
        initHudPlace();
        switchTab('generator');
        updateMorality(50);
        renderObligations();
        renderInventory();
        initCollapsibleSections();
    }
    // Перенос из браузера, последний открытый персонаж или окно «Персонажи» (подпроект 4б)
    showLoading('Загрузка персонажей…');
    const started = await startCharacters();
    if (started.error) { showLoadError(loadErrorKind('characters', navigator.onLine), { onRetry: startApp, onLogout: logoutFromLoading }); return; }
    // Пришли по ссылке-приглашению — окно «Вступить в кампанию» поверх листа
    openPendingJoin((campaignId, text) => openCampaigns({ select: campaignId, flash: text }));
}

// «Выйти»: сначала дописать несохранённое (не записалось — выход не выполняется, сообщение), затем
// договориться с другими вкладками (logout-flow.js). На экране загрузки своей правки нет — только
// другие вкладки
const logoutAfterSave = () => logoutWithTabs(beforeLogout);
const logoutFromLoading = () => logoutWithTabs();

initAuth(startApp);

// Step 4: Wire the remaining addEventListener calls
document.getElementById('char-name').addEventListener('input', () => { saveSession(); renderHudCard(); });
window.addEventListener('click', (e) => { const m = document.getElementById('avatar-menu'); if (m && !m.classList.contains('hidden') && !e.target.closest('#avatar-display')) m.classList.add('hidden'); });
document.getElementById('player-notes').addEventListener('input', () => {
    saveSession();
    const ind = document.getElementById('notes-save-indicator');
    if (ind) { ind.classList.remove('opacity-0'); setTimeout(() => ind.classList.add('opacity-0'), 1000); }
});

// Step 5: Window bridge
// ui-utils.js
window.switchTab = switchTab;
window.filterSkills = filterSkills;
// theme.js
window.setTheme = setTheme;
// text-size.js
window.setTextSize = setTextSize;
window.toggleTextSizeMenu = toggleTextSizeMenu;
window.closeTextSizeMenu = closeTextSizeMenu;
// char-setup-modal.js
window.openCharSetup = openCharSetup;
window.closeCharSetup = closeCharSetup;
window.toggleSystemMenu = toggleSystemMenu;
window.closeSystemMenu = closeSystemMenu;
// xp.js
window.applyXP = applyXP;
window.undoLastXP = undoLastXP;
// avatar.js
window.handleAvatarClick = handleAvatarClick;
window.uploadAvatar = uploadAvatar;
window.actionReplace = actionReplace;
window.actionDelete = actionDelete;
// obligations.js
window.addObligation = addObligation;
// inventory-equipment.js, catalog-picker.js
window.setCredits = setCredits;
window.openCatalogPicker = openCatalogPicker;
window.renderPickerList = renderPickerList;
window.addOwnFromPicker = addOwnFromPicker;
// choice-picker.js
window.openChoicePicker = openChoicePicker;
window.renderChoicePicker = renderChoicePicker;
window.choicePickerBack = choicePickerBack;
// race-skill-picker.js
window.openRaceSkillPicker = openRaceSkillPicker;
window.openRaceSkillChoice = openRaceSkillChoice;
window.renderRaceSkillPicker = renderRaceSkillPicker;
window.confirmRaceSkillPicker = confirmRaceSkillPicker;
// character-generator.js
window.updateMorality = updateMorality;
window.updateForce = updateForce;
window.toggleMobileSkills = toggleMobileSkills;
window.setLightsaberChar = setLightsaberChar;
window.toggleCareerSelection = toggleCareerSelection;
window.refundSkillRank = refundSkillRank;
window.buySkillRank = buySkillRank;
window.tryRefundStat = tryRefundStat;
window.tryBuyStat = tryBuyStat;
window.modifyThreshold = modifyThreshold;
window.modifyCurrent = modifyCurrent;
window.switchTreeMode = switchTreeMode;
window.updateSpec2Tab = updateSpec2Tab;
window.updateForceTabs = updateForceTabs;
// stat-panel.js
window.openStatPanel = openStatPanel;
window.closeStatPanel = closeStatPanel;
window.selectStat = selectStat;
// Карточка персонажа и панели (подпроект А2)
window.closeSheet = closeSheet;
window.openConditionPanel = openConditionPanel;
window.openEquipmentFromPanel = openEquipmentFromPanel;
window.openXPPanel = openXPPanel;
window.openForcePanel = openForcePanel;
window.changeForce = changeForce;
window.changeMorality = changeMorality;
window.openShade = openShade;
window.closeShade = closeShade;
// persistence.js
window.saveCharacter = saveCharacter;
window.startNewSession = startNewSession;
window.saveSession = saveSession;
window.addCrit = addCrit;
window.updateCrit = updateCrit;
window.removeCrit = removeCrit;
// auth-gate.js, character-session.js, character-list.js
window.logout = logoutAfterSave;
window.openCharacterList = openCharacterList;
// campaigns-screen.js (4.1)
window.openCampaigns = openCampaigns;
