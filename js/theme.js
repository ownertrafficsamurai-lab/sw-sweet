import { showToast } from './ui-utils.js';
import { closeSystemMenu } from './char-setup-modal.js';
import { THEME_KEY, themeOf, markThemeButtons } from './theme-list.js';

// Тема (подпроект А3, часть 3) — настройка устройства, как размер текста: одна для всех
// персонажей, хранится в localStorage (THEME_KEY), в автосейв не входит.
// «Джедай» — без атрибута, остальные — data-theme на <html> (переменные — css/themes.css).
// До первой отрисовки тему ставит скрипт #theme-boot в index.html; плитки [data-theme-btn] —
// в меню ☰.
export function setTheme(name) {
    const theme = themeOf(name);
    if (theme.id === 'jedi') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme.id;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', theme.color);
    try { localStorage.setItem(THEME_KEY, theme.id); } catch { /* хранилище недоступно — тема до перезагрузки */ }
    updateThemeButtons();
    closeSystemMenu();
    showToast('Тема: ' + theme.label, 'gold');
}

export function updateThemeButtons() {
    markThemeButtons(document.querySelectorAll('[data-theme-btn]'), themeOf(document.documentElement.dataset.theme).id);
}
