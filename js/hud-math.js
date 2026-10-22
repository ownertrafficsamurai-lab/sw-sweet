// Чистые функции карточки персонажа (подпроект А2) и размера текста (А3): жесты мини-блока,
// шторки и панелей, числа яруса XP, цвета полос ран и усталости, подписи морали, текст журнала XP,
// разбор ступени шрифта. Модуль ничего не импортирует и не трогает document, window и
// localStorage — его импортируют тесты в Node.

// Раскладка компьютера: окно не меньше 1024×560 (А3; было 1024×700 — ноутбуки 1366×768 и
// 1280×720 получали телефонную). Вкладки сверху, карточка строкой, без мини-блока и шторки.
export const DESKTOP_QUERY = '(min-width: 1024px) and (min-height: 560px)';

// Где карточка персонажа (А3, часть 2): на компьютере на «Листе» и «Способностях» — в боковой
// панели ('side'), иначе — в шапке ('header': на телефоне ярусами, на компьютере компактной строкой)
const SIDE_TABS = ['generator', 'abilities'];

export function cardSpot(desktop, tab) {
    return desktop && SIDE_TABS.includes(tab) ? 'side' : 'header';
}

// Размер текста (А3): ступени «Обычный / Крупный / Очень крупный» и ключ localStorage. Это
// настройка устройства, не персонажа. Неизвестное или испорченное значение — «Обычный». Тот же
// разбор повторяет встроенный скрипт #text-size-boot в index.html (tests/text-size.test.js).
export const TEXT_SIZES = ['m', 'l', 'xl'];
export const TEXT_SIZE_KEY = 'swrpg_text_size';

export function parseTextSize(value) {
    return TEXT_SIZES.includes(value) ? value : 'm';
}

// Жест по смещению указателя от нажатия до отпускания: тап — меньше 10 px по обеим осям;
// свайп — по вертикали не меньше 40 px, не меньше двойного смещения по горизонтали и не
// дольше 700 мс; всё остальное — ни то ни другое.
export function classifySwipe({ dx, dy, dt }) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax < 10 && ay < 10) return 'tap';
    if (ay >= 40 && ay >= 2 * ax && dt <= 700) return dy > 0 ? 'down' : 'up';
    return null;
}

// Свободный XP и доля потраченного — для яруса XP карточки и панели XP
export function xpSummary({ startXP, earned, spent }) {
    const total = startXP + earned;
    const free = total - spent;
    const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((spent / total) * 100))) : 0;
    return { free, total, spent, pct };
}

// Заполнение полосы ран или усталости — пороги цветов как у прежних карточек «Состояния»
export function vitalFill(type, current, max) {
    const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    const color = type === 'wounds'
        ? (pct >= 80 ? '#ef4444' : pct >= 50 ? '#f97316' : '#22c55e')
        : (pct >= 80 ? '#f97316' : pct >= 50 ? '#eab308' : '#60a5fa');
    return { pct, color };
}

// Подпись морали и её классы — пороги прежнего updateMorality
export function moralityStatus(value) {
    if (value <= 10) return { label: 'Тьма: Эффект 2', cls: 'text-red-500 font-black animate-pulse' };
    if (value <= 20) return { label: 'Тьма: Эффект 1', cls: 'text-red-400 font-bold' };
    if (value <= 30) return { label: 'Тёмная сторона', cls: 'text-red-300' };
    if (value >= 90) return { label: 'Свет: Эффект 2', cls: 'text-blue-100 font-black animate-pulse shadow-white' };
    if (value >= 80) return { label: 'Свет: Эффект 1', cls: 'text-blue-200 font-bold' };
    if (value >= 70) return { label: 'Светлая сторона', cls: 'text-blue-300' };
    return { label: 'Равновесие', cls: 'text-slate-400' };
}

// Записи журнала XP хранятся со старой HTML-разметкой (xp.js, автосейвы) — в новом интерфейсе
// показывается только текст, и выводится он через textContent
export function logEntryText(entry) {
    return String(entry).replace(/<[^>]*>/g, '');
}

// Наибольший рейтинг Силы: граница кнопки «+» панели «Сила» и проверки сохранения (save-check.js)
export const FORCE_RATING_MAX = 10;
