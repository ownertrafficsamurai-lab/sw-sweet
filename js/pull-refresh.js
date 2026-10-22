// Жест «потянуть вниз» (этап 5, спека 2026-10-20-live-party-dashboard.md, п. 5, макет
// live-states.html): в самом верху прокрутки тянем пальцем вниз — круг ↻, дальше порога — «Отпустите,
// чтобы обновить»; отпустили дальше порога — обновление, не дотянули — ничего. Только касания
// (мышью жеста нет). Встроенного жеста браузера на экране нет (overscroll-behavior: contain).
// pullView — чистая часть (тесты в Node); attachPull трогает document только при вызове.

// Мёртвая зона пальца, px; высота круга растёт вдвое медленнее пальца, не больше PULL_MAX;
// отпускание с высотой от PULL_READY — обновление
const PULL_START = 8;
export const PULL_READY = 60;
export const PULL_MAX = 96;

// dy — сколько палец прошёл вниз от касания → { offset — высота над содержимым, ready }
export function pullView(dy) {
    const offset = Math.min(PULL_MAX, Math.max(0, (dy - PULL_START) / 2));
    return { offset, ready: offset >= PULL_READY };
}

// scroller — прокручиваемый экран; indicator — #camp-pull (круг и надпись). enabled() — жест сейчас
// возможен; refresh() → Promise — обновить (пока идёт, круг вращается, новый жест не начинается)
export function attachPull(scroller, indicator, { enabled, refresh }) {
    let startY = null;
    let view = null;
    let busy = false;
    function show(offset, ready) {
        indicator.hidden = offset <= 0;
        indicator.style.height = `${offset}px`;
        indicator.style.setProperty('--pull-turn', `${offset * 3}deg`);
        indicator.classList.toggle('camp-pull-ready', ready);
    }
    scroller.addEventListener('touchstart', (e) => {
        view = null;
        startY = !busy && e.touches.length === 1 && scroller.scrollTop <= 0 && enabled() ? e.touches[0].clientY : null;
    }, { passive: true });
    scroller.addEventListener('touchmove', (e) => {
        if (startY === null) return;
        // Экран прокрутился (палец пошёл вверх и обратно) — это прокрутка, не жест
        if (scroller.scrollTop > 0) { startY = null; show(0, false); return; }
        view = pullView(e.touches[0].clientY - startY);
        show(view.offset, view.ready);
    }, { passive: true });
    scroller.addEventListener('touchend', async () => {
        if (startY === null) return;
        startY = null;
        if (!view?.ready) { show(0, false); return; }
        busy = true;
        indicator.classList.add('camp-pull-busy');
        try {
            await refresh();
        } finally {
            busy = false;
            indicator.classList.remove('camp-pull-busy');
            show(0, false);
        }
    });
    scroller.addEventListener('touchcancel', () => {
        if (startY === null) return;
        startY = null;
        show(0, false);
    });
}
