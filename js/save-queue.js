// Очередь записи персонажа в базу (подпроект 4б, спека 2026-10-02-character-in-database.md).
// Правки листа идут часто (каждая буква в поле зовёт saveSession), запись в базу — одна за раз и
// не раньше, чем через delay мс после последней правки. Модуль чистый: запрос и таймер передаются
// снаружи, document, window и Supabase он не трогает — его импортируют тесты в Node.
//
// write(text, version) → Promise<{ ok: true, version } | { conflict: true } | { error: string }>
// text — персонаж строкой JSON (снимок на момент правки), version — версия строки в базе.
// Состояния: 'clean' — всё записано; 'waiting' — правка ждёт паузы; 'writing' — идёт запрос;
// 'failed' — запрос не прошёл, правка ждёт повтора; 'conflict' — в базе другая версия, правки не
// принимаются до start(). onState(state, error) зовётся при смене состояния и при каждом сбое.
export function makeSaveQueue({ write, delay = 800, setTimer = setTimeout, clearTimer = clearTimeout, onState = () => {} }) {
    let version = null;  // версия строки в базе; null — персонаж не открыт
    let written = null;  // текст, который лежит в базе (null — неизвестен: первая правка пишется)
    let pending = null;  // текст, который ещё не отправлен
    let sending = null;  // текст идущего запроса
    let writing = null;  // обещание идущего запроса
    let timer = null;
    let status = 'clean';
    let epoch = 0;       // растёт при start / stop: ответ запроса прежнего персонажа отбрасывается

    const set = (next, error = null) => {
        if (status === next && next !== 'failed') return;
        status = next;
        onState(status, error);
    };
    const cancelTimer = () => {
        if (timer !== null) clearTimer(timer);
        timer = null;
    };
    const reset = (nextVersion, writtenText) => {
        epoch++;
        cancelTimer();
        version = nextVersion;
        written = writtenText;
        pending = null;
        // Идущий запрос прежнего персонажа отвязан: его ответ отбросит epoch
        writing = null;
        sending = null;
        set('clean');
    };

    function send() {
        cancelTimer();
        if (writing) return writing;
        if (pending === null || version === null) return Promise.resolve();
        const text = pending;
        const mine = epoch;
        pending = null;
        sending = text;
        set('writing');
        const request = Promise.resolve()
            .then(() => write(text, version))
            .catch(() => ({ error: 'network' }))
            .then((result) => {
                if (writing === request) { writing = null; sending = null; }
                if (mine !== epoch) return;
                if (result?.ok) {
                    version = result.version;
                    written = text;
                    // Правка, пришедшая во время запроса: её пауза ещё идёт — запишет таймер; уже
                    // прошла — пишется сразу
                    if (pending === null) set('clean');
                    else if (timer !== null) set('waiting');
                    else send();
                } else if (result?.conflict) {
                    pending = null;
                    cancelTimer();
                    set('conflict');
                } else {
                    // Сбой: несохранённой остаётся самая свежая правка; повтор — следующей правкой или flush()
                    if (pending === null) pending = text;
                    cancelTimer();
                    set('failed', result?.error ?? 'network');
                }
            });
        writing = request;
        return request;
    }

    return {
        // Персонаж открыт: версия из базы и текст, который там лежит (null — записать первую правку)
        start(nextVersion, writtenText = null) { reset(nextVersion, writtenText); },
        // Персонаж закрыт: несохранённое отбрасывается
        stop() { reset(null, null); },
        // Правка листа. Текст, который уже в базе или уже отправляется, записи не вызывает
        push(text) {
            if (version === null || status === 'conflict') return;
            if (pending === null && text === (sending ?? written)) return;
            pending = text;
            cancelTimer();
            timer = setTimer(() => { timer = null; send(); }, delay);
            if (status === 'clean') set('waiting');
        },
        // Записать сейчас, не дожидаясь паузы (смена персонажа, закрытие вкладки, «Повторить»).
        // Выполняется, когда записывать больше нечего или запись не удалась; возвращает состояние
        async flush() {
            let tried = false;
            for (;;) {
                if (writing) { await writing; continue; }
                if (pending === null || version === null || status === 'conflict') return status;
                if (tried && status === 'failed') return status;
                tried = true;
                await send();
            }
        },
        state: () => status,
        version: () => version,
    };
}
