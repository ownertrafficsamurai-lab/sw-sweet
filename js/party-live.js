// Живые обновления дашборда мастера (этап 5, спека 2026-10-20-live-party-dashboard.md, пп. 2 и 4):
// что делать с событиями канала party:<id кампании> (campaign-store.js watchParty), сети и видимости
// страницы. Чистый модуль: без document, сети и хранилища, таймеры передаются снаружи — тестируется
// в Node. Решает, когда дочитать изменившиеся листы (changed), когда догрузить группу целиком
// (resync) и есть ли связь (live) — отметка «Актуально» / «нет связи · с ЧЧ:ММ».

// Сообщения о правках копятся столько мс и уходят одной пачкой: «Исп.» стимпака и раны подряд — один запрос
export const BATCH_MS = 300;

// changed(ids) — эти листы изменились; resync() — догрузить состав и листы целиком (могли быть
// пропущены сообщения); update() — live() мог измениться
export function makePartyFeed({ changed, resync, update, setTimer, clearTimer }) {
    let stopped = false;
    // Пока канал не ответил, только что загруженные данные считаются свежими
    let channelUp = true;
    let networkUp = true;
    const pending = new Set();
    let timer = null;

    function flush() {
        timer = null;
        const ids = [...pending];
        pending.clear();
        if (ids.length) changed(ids);
    }

    return {
        // Сообщение `sheet` канала: id персонажа
        sheet(id) {
            if (stopped) return;
            pending.add(id);
            timer ??= setTimer(flush, BATCH_MS);
        },
        // Канал подключён ('live') или потерян ('lost'). Каждое подключение — догрузка: и первое
        // (правки между загрузкой карточек и подключением), и после обрыва (правки, пока связи не было)
        channel(state) {
            if (stopped) return;
            const up = state === 'live';
            if (up !== channelUp) { channelUp = up; update(); }
            if (up) resync();
        },
        // События браузера online / offline. Сеть вернулась — догрузка: канал мог и не заметить обрыва
        network(up) {
            if (stopped || up === networkUp) return;
            networkUp = up;
            update();
            if (up) resync();
        },
        // Страница снова видна (телефон разблокирован, вкладка открыта) — догрузка
        shown() {
            if (!stopped) resync();
        },
        live: () => channelUp && networkUp,
        stop() {
            stopped = true;
            if (timer) clearTimer(timer);
            timer = null;
            pending.clear();
        },
    };
}
