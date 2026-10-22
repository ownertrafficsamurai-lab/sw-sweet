// Выход из аккаунта — договорённость вкладок («Надёжная запись», п. 3, спека
// 2026-10-19-reliable-save.md). Вход общий для всех вкладок браузера: после signOut другие вкладки
// записать уже не могут. Поэтому до выхода вкладка спрашивает остальные по каналу
// (BroadcastChannel): каждая сразу откликается («слышу»), дописывает свою очередь записи и отвечает,
// записано ли (и имя своего персонажа). Модуль чистый: канал и таймеры передаются снаружи — его
// импортируют тесты в Node. Канал — { postMessage, addEventListener, removeEventListener }.
//
// Сообщения: { type: 'ask', ask } → { type: 'heard', ask, tab, name } → { type: 'done', ask, tab,
// saved, name }. ask — id вопроса, tab — id отвечающей вкладки.

// Не откликнулась за это время — «усыплена» браузером (или старая версия приложения): выход не держит
export const HEARD_MS = 1000;
// Ожидание дольше — надпись WAIT_TEXT, чтобы нажатие «Выйти» не казалось пропавшим
export const SLOW_MS = 1500;
// Откликнулась, но не ответила — «не записала»: таймаут запроса (20 с) и запас
export const ANSWER_MS = 22000;
export const WAIT_TEXT = 'Дописываем изменения в других вкладках…';

// Отвечать на вопросы о выходе. flush() → Promise<boolean> — дописать свою очередь, true — всё
// записано; name() — имя открытого персонажа для окна (displayName)
export function answerAsks({ channel, tab, flush, name }) {
    channel.addEventListener('message', async ({ data }) => {
        if (data?.type !== 'ask') return;
        channel.postMessage({ type: 'heard', ask: data.ask, tab, name: name() });
        let saved = false;
        try { saved = await flush() === true; } catch { saved = false; }
        channel.postMessage({ type: 'done', ask: data.ask, tab, saved, name: name() });
    });
}

// Спросить остальные вкладки. → Promise<string[]> — имена персонажей во вкладках, которые не
// записали (без повторов); пусто — можно выходить. Ждёт HEARD_MS отклика, затем — ответов
// откликнувшихся, но не дольше ANSWER_MS от вопроса. onSlow — ожидание дольше SLOW_MS
export function askOtherTabs({ channel, ask, onSlow = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
    return new Promise((resolve) => {
        const tabs = new Map();   // вкладка → { name, saved: true | false | null — ещё не ответила }
        let hearing = true;
        let finished = false;
        const timers = [];
        const settled = () => [...tabs.values()].every(t => t.saved !== null);
        const finish = () => {
            if (finished) return;
            finished = true;
            timers.forEach(clearTimer);
            channel.removeEventListener('message', onMessage);
            resolve([...new Set([...tabs.values()].filter(t => t.saved !== true).map(t => t.name))]);
        };
        function onMessage({ data }) {
            if (data?.ask !== ask) return;
            if (data.type === 'heard' && hearing && !tabs.has(data.tab)) tabs.set(data.tab, { name: data.name, saved: null });
            if (data.type === 'done' && tabs.has(data.tab)) {
                tabs.set(data.tab, { name: data.name, saved: data.saved === true });
                if (!hearing && settled()) finish();
            }
        }
        channel.addEventListener('message', onMessage);
        timers.push(setTimer(() => { hearing = false; if (settled()) finish(); }, HEARD_MS));
        timers.push(setTimer(() => { if (!finished) onSlow(); }, SLOW_MS));
        timers.push(setTimer(finish, ANSWER_MS));
        channel.postMessage({ type: 'ask', ask });
    });
}

// Окно «В другой вкладке не записаны изменения» (вариант A). names — имена без повторов; каждое — в
// своих кавычках, через запятую (в имени самом может быть запятая)
export function otherTabsNotice(names) {
    return {
        message: `В другой вкладке не записаны изменения ${names.map(n => `«${n}»`).join(', ')}.`,
        note: 'Если выйти сейчас, они пропадут.',
    };
}
