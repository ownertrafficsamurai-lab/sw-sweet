import { TEXT_SIZE_KEY, parseTextSize } from './hud-math.js';
import { refreshShade } from './hud-collapse.js';
import { closeSystemMenu } from './char-setup-modal.js';

// Размер текста (подпроект А3): «Обычный / Крупный / Очень крупный» — множитель базы шрифта
// (css/style.css, --text-k). Настройка устройства, не персонажа: одна для всех персонажей,
// хранится в localStorage (TEXT_SIZE_KEY), в автосейв и файл персонажа не входит. Атрибут
// data-text-size на <html> до первой отрисовки ставит скрипт #text-size-boot в index.html.
// Кнопки [data-text-size-btn] — в меню ☰ и во всплывающем меню «Aa» (только компьютер).
const byId = id => document.getElementById(id);

export function setTextSize(size) {
    const value = parseTextSize(size);
    document.documentElement.dataset.textSize = value;
    try { localStorage.setItem(TEXT_SIZE_KEY, value); } catch { /* хранилище недоступно — ступень до перезагрузки */ }
    updateTextSizeButtons();
    // Меню, панели и шторка остаются открытыми; шторка пересчитывает место под новую карточку
    refreshShade();
}

export function updateTextSizeButtons() {
    const current = parseTextSize(document.documentElement.dataset.textSize);
    document.querySelectorAll('[data-text-size-btn]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.textSizeBtn === current));
    });
}

export function toggleTextSizeMenu(e) {
    e.stopPropagation();
    closeSystemMenu();
    const open = !byId('text-size-menu').classList.toggle('hidden');
    byId('text-size-btn').setAttribute('aria-expanded', String(open));
}

export function closeTextSizeMenu() {
    byId('text-size-menu').classList.add('hidden');
    byId('text-size-btn').setAttribute('aria-expanded', 'false');
}

export function initTextSize() {
    updateTextSizeButtons();
    // Клик мимо меню «Aa» и Esc закрывают его — как системное меню (char-setup-modal.js).
    // Esc при открытом меню возвращает фокус на кнопку «Aa»; при закрытом фокус не трогает.
    window.addEventListener('click', (e) => {
        if (!byId('text-size-menu').contains(e.target) && !byId('text-size-btn').contains(e.target)) closeTextSizeMenu();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || byId('text-size-menu').classList.contains('hidden')) return;
        closeTextSizeMenu();
        byId('text-size-btn').focus();
    });
}
