import { classifySwipe, DESKTOP_QUERY } from './hud-math.js';
import { isSheetOpen } from './bottom-sheet.js';

// Только телефон (подпроект А2): когда верхняя строка с карточкой уходит из вида, наверху
// закрепляется мини-блок (#hud-mini); тап или свайп вниз по нему открывает шторку — это тот же
// элемент #hud-top, переведённый в фиксированный слой (css: body.hud-shade-open), поэтому id внутри
// карточки остаются единственными и перерисовка одна. Пока шторка открыта, прокрутка страницы
// заблокирована, а #hud-slot держит высоту карточки, чтобы контент под ней не сдвигался.
// Закрыть: свайп вверх по шторке, тап по затемнению или «язычку», Esc, переход на другую вкладку.
// На компьютере (DESKTOP_QUERY) не работает: карточка закреплена и не сворачивается.
const byId = id => document.getElementById(id);
const desktop = window.matchMedia(DESKTOP_QUERY);
let shadeOpen = false;

export function isShadeOpen() {
    return shadeOpen;
}

export function openShade() {
    if (shadeOpen || desktop.matches) return;
    byId('hud-slot').style.height = byId('hud-top').offsetHeight + 'px';
    shadeOpen = true;
    document.body.classList.add('hud-shade-open');
    document.documentElement.style.overflow = 'hidden';
    // Если шторка не помещается по высоте (альбомный телефон), разрешаем прокрутку пальцем —
    // тогда свайп вверх может не сработать, закрывают «Свернуть», затемнение и Esc
    const top = byId('hud-top');
    top.classList.toggle('hud-shade-scroll', top.scrollHeight > top.clientHeight);
}

export function closeShade() {
    if (!shadeOpen) return;
    shadeOpen = false;
    document.body.classList.remove('hud-shade-open');
    document.documentElement.style.overflow = '';
    byId('hud-slot').style.height = '';
    byId('hud-top').classList.remove('hud-shade-scroll');
}

// Смена размера текста при открытой шторке (text-size.js): место под карточку и прокрутка
// шторки — по новой высоте карточки. Место — высота карточки в потоке страницы, а не открытой
// шторки: вся высота содержимого (scrollHeight — и когда она не помещается в экран) плюс рамка,
// без «язычка» (он виден только в шторке). Иначе закрытие шторки сдвигает страницу. Мерится без
// hud-shade-scroll: полоса прокрутки шторки (style.css, 4 px) сужает карточку, и текст в ней
// переносится иначе, чем в потоке; положение прокрутки шторки сохраняется.
export function refreshShade() {
    if (!shadeOpen) return;
    const top = byId('hud-top');
    const scrolled = top.scrollTop;
    top.classList.remove('hud-shade-scroll');
    const inFlow = top.scrollHeight + (top.offsetHeight - top.clientHeight) - byId('hud-shade-handle').offsetHeight;
    byId('hud-slot').style.height = inFlow + 'px';
    top.classList.toggle('hud-shade-scroll', top.scrollHeight > top.clientHeight);
    top.scrollTop = scrolled;
}

// Свайп: смещение от pointerdown до pointerup (classifySwipe). Тапы обрабатывают обычные onclick.
function onSwipe(el, handler) {
    let start = null;
    el.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY, t: e.timeStamp }; });
    el.addEventListener('pointerup', (e) => {
        if (!start) return;
        const s = start;
        start = null;
        handler(classifySwipe({ dx: e.clientX - s.x, dy: e.clientY - s.y, dt: e.timeStamp - s.t }));
    });
    el.addEventListener('pointercancel', () => { start = null; });
}

export function initHudCollapse() {
    new IntersectionObserver(([entry]) => {
        document.body.classList.toggle('hud-collapsed', !entry.isIntersecting);
    }).observe(byId('hud-slot'));
    onSwipe(byId('hud-mini'), (gesture) => { if (gesture === 'down') openShade(); });
    onSwipe(byId('hud-top'), (gesture) => { if (gesture === 'up') closeShade(); });
    desktop.addEventListener('change', () => { if (desktop.matches) closeShade(); });
}

// Слои поверх шторки: пока открыт любой из них, Esc закрывает его, а не шторку
const LAYERS_ABOVE = ['modal-overlay', 'stat-panel', 'char-setup-modal', 'system-menu', 'campaigns-screen'];

// window, фаза захвата — раньше общего обработчика Esc (char-setup-modal.js), который успел бы
// закрыть «Настройку персонажа» или меню до проверки. Панели (bottom-sheet.js) обрабатывают Esc
// ещё раньше и останавливают событие. Закрыв шторку, Esc дальше не идёт — как у панелей: в
// просмотре листа игрока (party-view.js) он иначе закрыл бы и просмотр
window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !shadeOpen) return;
    if (isSheetOpen() || byId('incap-overlay')) return;
    if (LAYERS_ABOVE.some(id => !byId(id).classList.contains('hidden'))) return;
    closeShade();
    e.stopImmediatePropagation();
}, true);
