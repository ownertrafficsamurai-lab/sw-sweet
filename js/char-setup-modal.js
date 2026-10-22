import { updateThemeButtons } from './theme.js';
import { closeTextSizeMenu } from './text-size.js';

export function toggleSystemMenu(e) {
    e.stopPropagation();
    // Меню «Aa» (компьютер) не остаётся открытым под системным: клик по ☰ до окна не доходит
    closeTextSizeMenu();
    const menu = document.getElementById('system-menu');
    menu.classList.toggle('hidden');
    if (!menu.classList.contains('hidden')) updateThemeButtons();
}

export function closeSystemMenu() {
    document.getElementById('system-menu').classList.add('hidden');
}

// === CHAR SETUP MODAL ===
let afterClose = [];
export function openCharSetup() {
    document.getElementById('char-setup-modal').classList.remove('hidden');
}
export function closeCharSetup() {
    document.getElementById('char-setup-modal').classList.add('hidden');
    updateCharInfoDisplay();
    for (const callback of afterClose.splice(0)) callback();
}
// callback — один раз, когда «Настройка персонажа» закроется (4.1: окно вступления по ссылке ждёт её)
export function afterCharSetupClosed(callback) {
    afterClose.push(callback);
}
export function updateCharInfoDisplay() {
    const el = document.getElementById('char-info-display');
    if (!el) return;
    const raceSel = document.getElementById('gen-race');
    const careerSel = document.getElementById('gen-career');
    const specSel = document.getElementById('gen-spec');
    const spec2Sel = document.getElementById('gen-spec2');
    const f1 = document.getElementById('force-p1');
    const f2 = document.getElementById('force-p2');
    const raceName = raceSel?.options[raceSel.selectedIndex]?.text || '—';
    const careerName = careerSel?.options[careerSel.selectedIndex]?.text || '—';
    const specName = specSel?.options[specSel.selectedIndex]?.text || '—';
    const spec2Name = spec2Sel?.value ? spec2Sel.options[spec2Sel.selectedIndex]?.text : null;
    const f1Name = f1?.value ? f1.options[f1.selectedIndex]?.text : null;
    const f2Name = f2?.value ? f2.options[f2.selectedIndex]?.text : null;
    let parts = [raceName, `${careerName} / ${specName}`];
    if (spec2Name) parts.push(spec2Name);
    const forceParts = [f1Name, f2Name].filter(Boolean);
    if (forceParts.length) parts.push('⚡ ' + forceParts.join(', '));
    el.textContent = parts.join(' · ');
}

// Закрыть меню при клике в любое место экрана
window.addEventListener('click', (e) => {
    const menu = document.getElementById('system-menu');
    const btn = document.getElementById('menu-btn');

    // Если меню открыто И клик был НЕ по меню И НЕ по кнопке открытия
    if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
        closeSystemMenu();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('modal-overlay');
        // Esc закрывает только подтверждение: «Настройка персонажа» и окно выбора под ним остаются
        if (overlay && !overlay.classList.contains('hidden')) {
            // Вопрос, на который нужен ответ (перенос, расхождение версий), Esc не закрывает
            if (overlay.dataset.sticky) return;
            overlay.classList.add('hidden');
            document.getElementById('modal-message').innerHTML = '';
            return;
        }
        const charSetup = document.getElementById('char-setup-modal');
        if (charSetup && !charSetup.classList.contains('hidden')) closeCharSetup();
        closeSystemMenu();
    }
});
