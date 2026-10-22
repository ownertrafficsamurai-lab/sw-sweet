import { DESKTOP_QUERY, cardSpot } from './hud-math.js';
import { updateGeneratorUI } from './character-generator.js';

// Место карточки персонажа (подпроект А3, часть 2). Разметка одна (#hud-card, id не дублируются) —
// модуль только переносит узел: на компьютере на «Листе» и «Способностях» — в боковую панель
// вкладки (#side-slot-generator / #side-slot-abilities), иначе — домой в шапку (#hud-card-home:
// телефон — ярусами, компьютер — компактной строкой; вид задаёт css/style.css). Переносит при смене
// вкладки (switchTab), при переходе окна между раскладками телефона и компьютера и на время печати
// (печать — карточка первой, как в А2).
const byId = id => document.getElementById(id);
const desktop = window.matchMedia(DESKTOP_QUERY);
let currentTab = 'generator';

export function placeHudCard(tab = currentTab) {
    currentTab = tab;
    const card = byId('hud-card');
    const target = cardSpot(desktop.matches, tab) === 'side' ? byId('side-slot-' + tab) : byId('hud-card-home');
    if (card.parentElement !== target) target.appendChild(card);
}

export function initHudPlace() {
    // Высота закреплённой шапки — отступ закреплённой боковой панели (--hud-slot-h в style.css)
    const slot = byId('hud-slot');
    new ResizeObserver(() => {
        document.documentElement.style.setProperty('--hud-slot-h', slot.getBoundingClientRect().height + 'px');
    }).observe(slot);
    // Переход между раскладками: карточка — на своё место, «Знания» — в свою таблицу или в «Общие»
    // (перерисовка листа; сохранение до загрузки персонажа не пишет — state.isSaveReady)
    desktop.addEventListener('change', () => {
        placeHudCard();
        updateGeneratorUI();
    });
    window.addEventListener('beforeprint', () => byId('hud-card-home').appendChild(byId('hud-card')));
    window.addEventListener('afterprint', () => placeHudCard());
}
