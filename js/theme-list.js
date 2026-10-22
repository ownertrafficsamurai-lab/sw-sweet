// Темы (подпроект А3, часть 3): ключ, название и цвет строки браузера (<meta name="theme-color">,
// под верхнюю строку темы). Порядок — порядок плиток в меню ☰. Чистый модуль без DOM: его
// используют theme.js и тесты. Те же ключи и цвета повторяет встроенный скрипт #theme-boot в
// index.html (проверка — tests/themes.test.js).
export const THEME_KEY = 'sw_theme';

export const THEMES = [
    { id: 'jedi', label: 'Джедай', color: '#0f172a' },
    { id: 'sith', label: 'Ситх', color: '#120406' },
    { id: 'imperial', label: 'Империя', color: '#0a0c14' },
    { id: 'rebel', label: 'Альянс повстанцев', color: '#15171c' },
    { id: 'mando', label: 'Мандалорец', color: '#0f1316' },
    { id: 'light', label: 'Светлая', color: '#ffffff' },
];

// Известная тема — она сама; всё остальное (пусто, старое или чужое значение) — «Джедай»
export function themeOf(value) {
    return THEMES.find(t => t.id === value) || THEMES[0];
}

// Плитки [data-theme-btn]: выбранная — aria-pressed="true", остальные — "false"
export function markThemeButtons(buttons, currentId) {
    for (const btn of buttons) btn.setAttribute('aria-pressed', String(btn.dataset.themeBtn === currentId));
}
