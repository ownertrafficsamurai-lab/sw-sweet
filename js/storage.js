// Хранилище браузера (localStorage) может быть недоступно: при запрете данных сайтов само
// обращение к localStorage бросает исключение, при переполнении — запись. Эта обёртка не бросает:
// чтение даёт null, запись и удаление — false, а failed() сообщает, что хранилище подвело
// (подпроект 4а, спека 2026-10-02-clean-save-data.md). getStorage вызывается при каждом обращении
// внутри try — модуль можно импортировать и там, где localStorage нет (тесты в Node).
export function makeStore(getStorage) {
    let failed = false;
    const attempt = (action, fallback) => {
        try { return action(getStorage()); } catch { failed = true; return fallback; }
    };
    return {
        get: key => attempt(s => s.getItem(key), null),
        set: (key, value) => attempt(s => { s.setItem(key, value); return true; }, false),
        remove: key => attempt(s => { s.removeItem(key); return true; }, false),
        failed: () => failed,
    };
}

export const store = makeStore(() => localStorage);
// Хранилище вкладки: код ссылки-приглашения ждёт в нём входа (4.1)
export const sessionStore = makeStore(() => sessionStorage);
