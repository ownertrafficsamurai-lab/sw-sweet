// Общий пул Судьбы стола (этап 5, часть 2, спека 2026-10-21-destiny-pool.md): что показать в строке
// «Судьба», в панели «Судьба стола» и на плашке внизу экрана. Чистый модуль: без document, сети и
// хранилища, таймеры передаются снаружи — тестируется в Node. Пул приходит из базы (destiny_pool,
// ответы трат) и из канала destiny:<id кампании>: { light, dark, seq, last: { kind, name, at } | null }.

// «Задать пул»: светлых и тёмных — от 0 до SIDE_MAX (трата может сделать сторону больше)
export const SIDE_MAX = 20;
// Больше CIRCLES_MAX жетонов — в строке только числа, без кружков
export const CIRCLES_MAX = 10;
// Плашка внизу экрана держится BAR_MS
export const BAR_MS = 4000;

const KINDS = ['light', 'dark', 'undo', 'set'];
const count = n => Number.isInteger(n) && n >= 0;

// Пул из ответа базы или сообщения канала; не пул — null
export function readPool(raw) {
    if (!raw || typeof raw !== 'object' || !count(raw.light) || !count(raw.dark) || !count(raw.seq)) return null;
    const last = raw.last;
    const known = last && typeof last === 'object' && KINDS.includes(last.kind) && typeof last.at === 'string' && !Number.isNaN(Date.parse(last.at));
    return {
        light: raw.light, dark: raw.dark, seq: raw.seq,
        last: known ? { kind: last.kind, name: typeof last.name === 'string' ? last.name : null, at: last.at } : null,
    };
}

// Ответы и сообщения приходят не по порядку: остаётся пул с большим seq (при равном — известный)
export function newerPool(known, next) {
    if (!next) return known;
    return !known || next.seq > known.seq ? next : known;
}

// Пул не задан: мастер ещё не задавал его или задал 0 : 0
export const isUnset = pool => pool.light + pool.dark === 0;

// Число со словом: 1 светлый / 2 светлых / 5 светлых; 1 жетон / 3 жетона / 11 жетонов
function plural(n, one, few, many = few) {
    const tens = n % 100;
    const word = n % 10 === 1 && tens !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14) ? few : many;
    return `${n} ${word}`;
}

// Строка «Судьба». role — 'gm' | 'player': незаданный пул у мастера — вход в «Задать пул»
export function rowView(pool, role) {
    if (isUnset(pool)) {
        const text = role === 'gm' ? 'Пул не задан' : 'Мастер ещё не задал пул';
        return { unset: true, text, circles: false, label: `Судьба: ${text.toLowerCase()}` };
    }
    return {
        unset: false,
        text: `${pool.light} : ${pool.dark}`,
        circles: pool.light + pool.dark <= CIRCLES_MAX,
        label: `Судьба: ${plural(pool.light, 'светлый', 'светлых')}, ${plural(pool.dark, 'тёмный', 'тёмных')}`,
    };
}

const who = name => (name === null ? 'Мастер' : name.trim() || 'Без имени');

// Текст события для плашки и строки «Последнее». У «пул задан» числа — нынешние числа пула (пока
// последнее действие — задание пула, они те же)
export function eventText(last, pool) {
    if (last.kind === 'light') return `${who(last.name ?? '')}: светлый → тёмный`;
    if (last.kind === 'dark') return 'Мастер: тёмный → светлый';
    if (last.kind === 'undo') return `${who(last.name)}: отмена`;
    return `Мастер задал пул: ${pool.light} : ${pool.dark}`;
}

// Плашка чужого действия (макет pool-who.html): текст, кто (жирным), у траты — жетоны «откуда → куда»
// ('l' | 'd'), gm — действие мастера (полоска плашки — его цвет)
export function eventBar(last, pool) {
    const spend = last.kind === 'light' || last.kind === 'dark';
    const gm = last.kind === 'dark' || last.kind === 'set' || last.name === null;
    return {
        text: eventText(last, pool),
        who: gm ? 'Мастер' : who(last.name ?? ''),
        from: spend ? last.kind[0] : null,
        to: spend ? (last.kind === 'light' ? 'd' : 'l') : null,
        gm,
    };
}

// Своя плашка после траты стороны side (макет pool-placement.html): «● → ● Жетон потрачен · Отменить»
export function spentBar(side, undo) {
    return side === 'light' ? { text: 'Жетон потрачен', undo, from: 'l', to: 'd' } : { text: 'Жетон потрачен', undo, from: 'd', to: 'l' };
}

// Местное время «Ч:ММ» — как отметка дашборда (party-model.js liveLabel)
export function clock(at) {
    return `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`;
}

// Нижняя строка панели: последнее действие или, пока действий не было, «Всего N жетонов …»
export function noteText(pool) {
    if (pool.last) return `Последнее: ${eventText(pool.last, pool)} · ${clock(new Date(pool.last.at))}`;
    return isUnset(pool) ? '' : `Всего ${plural(pool.light + pool.dark, 'жетон', 'жетона', 'жетонов')} · раскладку задаёт мастер`;
}

// Отметка панели: «Актуально» / «нет связи · с Ч:ММ» (время последних данных)
export function liveText(live, at) {
    return live ? 'Актуально' : `нет связи · с ${clock(at)}`;
}

// Счётчик окна «Задать пул»: шаг в пределах 0…SIDE_MAX
export function stepSide(n, delta) {
    return Math.min(SIDE_MAX, Math.max(0, n + delta));
}

// Короткие сообщения на плашке. action — 'spend' | 'undo' | 'set'; error — вид исхода
export function failText(action, error) {
    if (error === 'empty') return action === 'undo' ? 'Нельзя отменить — жетон уже потрачен' : 'Жетон уже потрачен';
    if (error === 'forbidden') return 'Нет доступа к пулу этой кампании';
    if (action === 'undo') return 'Нет связи — отмена не прошла';
    if (action === 'set') return 'Нет связи — пул не задан';
    return 'Нет связи — жетон не потрачен';
}

// Очередь плашки. Своя (после своей траты — с «Отменить», или сообщение о неудаче) показывается сразу
// и держится BAR_MS, чужие её не вытесняют: пришедшая во время своей ждёт и показывается после неё
// (из ждущих — только последняя). Чужая без своей сменяет предыдущую чужую.
// show(item) — показать { text, undo? }; hide() — убрать
export function makeBar({ show, hide, setTimer, clearTimer }) {
    let current = null;     // 'own' | 'foreign' | null
    let waiting = null;
    let timer = null;

    function put(kind, item) {
        if (timer) clearTimer(timer);
        current = kind;
        show(item);
        timer = setTimer(done, BAR_MS);
    }
    function done() {
        timer = null;
        current = null;
        if (waiting) {
            const next = waiting;
            waiting = null;
            put('foreign', next);
        } else {
            hide();
        }
    }
    return {
        own: item => put('own', item),
        foreign(item) {
            if (current === 'own') waiting = item;
            else put('foreign', item);
        },
        // Своя плашка больше не нужна (удачная «Отменить»): ждущая чужая — сразу, иначе убрать
        dismiss() {
            if (timer) clearTimer(timer);
            done();
        },
        // Убрать сейчас (смена кампании, конец просмотра): без ждущих
        clear() {
            if (timer) clearTimer(timer);
            timer = null;
            current = null;
            waiting = null;
            hide();
        },
        showing: () => current,
    };
}
