// Создание персонажа без копий («Надёжная запись», п. 1, спека 2026-10-19-reliable-save.md). Каждое
// создание идёт со своим id из браузера. Ответ не пришёл (таймаут, обрыв) — база могла строку
// принять: приложение молча ищет её по id, а повтор того же действия идёт с тем же id — вторую
// строку не пустит первичный ключ. Модуль чистый — его импортируют тесты в Node.
//
// Вид ответа вставки (character-store.js): 'network' | 'exists' (такой id уже есть) | 'limit' |
// 'too_big'. retry — этот id уже отправлялся раньше (запомненное «неясное» создание).

// Ключи действий в памяти вкладки: «+ Новый» (в окне «Персонажи» и при вступлении в кампанию) —
// одно действие; импорт — по тексту файла. Перенос из браузера помнит id в localStorage (не здесь)
export const NEW_KEY = 'new';
export const importKey = text => `import:${text}`;

// Искать ли строку по id после неудачной вставки. Предел при первой попытке — ответ ясный: id ещё
// не отправлялся, строки с ним нет
export function needsCheck(error, retry) {
    return error === 'network' || error === 'exists' || (retry && error === 'limit');
}

// Что делать после неудачной вставки. found — ответ loadCharacter по id ({ ok } | { missing } |
// { error }), null — не искали. → { open: true } — строка есть, открыть её; иначе { message, keep }:
// message — ключ сообщения ('create' | 'limit' | 'tooBig'), keep — id помнится для повтора
export function afterFailedCreate(error, found, retry) {
    if (found?.ok) return { open: true };
    if (error === 'network') return { message: 'create', keep: true };
    // Ключ занят, а строки у владельца нет — чужой id (совпадение): повтор возьмёт новый. Поиск не
    // прошёл — неизвестно, наша ли строка: id помнится
    if (error === 'exists') return { message: 'create', keep: !found?.missing };
    return { message: error === 'too_big' ? 'tooBig' : error === 'limit' ? 'limit' : 'create', keep: retry };
}

// Неясные создания вкладки: ключ действия → id. slot(key) — место одного действия
// { get() → id | null, set(id), clear() } (так же устроено место переноса в localStorage);
// forget(ids) — персонажи с этими id уже есть (открыт, в загруженном списке): их действие
// следующим разом создаёт нового
export function makePendingCreates() {
    const ids = new Map();
    return {
        slot: key => ({
            get: () => ids.get(key) ?? null,
            set: (id) => { ids.set(key, id); },
            clear: () => { ids.delete(key); },
        }),
        forget(seen) {
            const known = new Set(seen);
            for (const [key, id] of ids) if (known.has(id)) ids.delete(key);
        },
    };
}
