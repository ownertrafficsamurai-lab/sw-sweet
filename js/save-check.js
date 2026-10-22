// Проверка сохранения персонажа (подпроект 4а, спека 2026-10-02-clean-save-data.md). Сохранение —
// JSON из автосейва или импортированного файла — может быть любым: старой версии, испорченным,
// собранным руками. Здесь оно переводится в форму текущей версии (migrateSession) и проверяется по
// полям (checkSave): всё, что не соответствует ожидаемой форме, заменяется значением по умолчанию,
// а пользователь получает список исправлений. Модуль чистый: не трогает document, window и
// localStorage — его импортируют тесты в Node.
import { ALL_SKILLS, renameLegacySkills } from './skills.js';
import { STAT_ORDER } from './stat-info.js';
import { migrateInventory, normalizeInventory } from './inventory.js';
import { logEntryText, FORCE_RATING_MAX } from './hud-math.js';

export const SESSION_VERSION = 7;

const isObject = v => typeof v === 'object' && v !== null && !Array.isArray(v);

// Версия сохранения: целое от 1; сохранения MVP и испорченное значение — версия 1
export function saveVersion(s) {
    return Number.isSafeInteger(s._version) && s._version >= 1 ? s._version : 1;
}

// Запись журнала XP длиннее этой границы — не запись приложения (те — десятки знаков): её не
// просматривают (очистка тегов на строке из сотен тысяч «<» идёт минуты), checkLog её убирает
const LOG_ENTRY_MAX = 200;
const isLogEntry = entry => typeof entry === 'string' && entry.length <= LOG_ENTRY_MAX;

const plainLog = log => log.map(entry => (isLogEntry(entry) ? logEntryText(entry) : entry));

// Старое сохранение → форма текущей версии. Меняет и возвращает s; поля могут быть испорчены —
// их типы проверяет checkSave, здесь важно только не упасть
export function migrateSession(s) {
    const v = saveVersion(s);
    if (v < 3) {
        if (s.spec2Val === undefined) s.spec2Val = 'none';
    }
    if (v < 4) renameLegacySkills(s); // старые названия навыков → словарь базы (skills.js)
    if (!s.obligations) s.obligations = [];
    // Инвентарь подпроекта Б1: items[] вместо weapons[] / equipment[], броня — предмет вместо
    // числа armorVal. Сохранение нового вида (и импортированный файл) приводится к той же форме
    s.inventory = Array.isArray(s.inventory?.items) ? normalizeInventory(s.inventory) : migrateInventory(s.inventory, s.armorVal);
    delete s.armorVal;
    // Версия 6: выбранные расовые навыки. Бесплатные ранги старым сохранениям начисляет
    // loadSession — для этого нужен справочник рас
    if (!Array.isArray(s.raceSkills)) s.raceSkills = [];
    // Версия 7: журнал XP — чистый текст (и в снимках «Отменить»); полей Судьбы нет
    if (v < 7) {
        if (Array.isArray(s.xpLog)) s.xpLog = plainLog(s.xpLog);
        if (Array.isArray(s.xpHistory)) {
            for (const snap of s.xpHistory) if (isObject(snap) && Array.isArray(snap.log)) snap.log = plainLog(snap.log);
        }
    }
    delete s.destinyLight;
    delete s.destinyDark;
    s._version = SESSION_VERSION;
    return s;
}

// ---- Проверка по полям ----

// Поля сохранения текущей версии (вместе с _version — всё, что пишет saveSession). Объект без
// единого из них — не персонаж
const FIELDS = [
    'charName', 'playerNotes', 'raceVal', 'careerVal', 'specVal', 'spec2Val', 'forceP1', 'forceP2',
    'charAvatar', 'forceRating', 'criticalInjuries', 'statMods', 'thresholdMods', 'currentStatus',
    'purchasedTalents', 'usedTalents', 'xpData', 'xpHistory', 'xpLog', 'skillRanks', 'morality',
    'selectedCareerSkills', 'raceSkills', 'lightsaberChar', 'obligations', 'inventory',
];
const SKILLS = new Set(ALL_SKILLS.map(s => s.name));
const STAT_LABELS = { brawn: 'Физ. сила', agility: 'Ловкость', intellect: 'Интеллект', cunning: 'Смекалка', willpower: 'Воля', presence: 'Харизма' };
const OBLIGATION_TYPES = ['obligation', 'duty', 'other'];
const NODE_ID = /^[a-z0-9_]+$/;
const AVATAR = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
// Аватар приложения — картинка 150 px (avatar.js), десятки килобайт; граница — с запасом
const AVATAR_MAX = 300000;
const NONE = 'none';
const STAT_MAX = 7;
const RANK_MAX = 5;
const LOG_MAX = 5;
const HISTORY_MAX = 10;
const CAREER_SKILLS_MAX = 3;
const CRITS_MAX = 4;
// Границы размера (подпроект 4б): персонаж лежит в общей базе. Длины — в знаках, как maxlength
// полей ввода; те же числа стоят у полей и кнопок добавления
export const LIMITS = { name: 100, notes: 20000, crit: 300, obligationDesc: 300, itemText: 1000, obligations: 50, items: 300 };
// Знаки, которые jsonb базы не принимает: U+0000 и половинки суррогатных пар
const BAD_CHARS = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

const isCount = v => Number.isSafeInteger(v) && v >= 0;
const isNumber = v => typeof v === 'number' && Number.isFinite(v);
// Значение из файла для строки исправления: коротко и одной строкой (выводится через textContent)
const show = (v) => {
    const text = (typeof v === 'string' ? v : JSON.stringify(v) ?? String(v)).replace(/\s+/g, ' ');
    return text.length > 40 ? text.slice(0, 40) + '…' : text;
};

// Текст не длиннее max знаков; пара суррогатов (эмодзи) на границе не разрывается
export function cutText(text, max) {
    if (text.length <= max) return text;
    const last = text.charCodeAt(max - 1);
    return text.slice(0, last >= 0xD800 && last <= 0xDBFF ? max - 1 : max);
}

// Один и тот же персонаж? jsonb базы хранит ключи объектов в своём порядке, поэтому порядок
// ключей не важен; порядок элементов списков — важен
function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
}

export function sameSave(a, b) {
    return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

// Все строки значения — без знаков, которые не принимает база; onChange — если что-то убрано
function cleanStrings(value, onChange) {
    if (typeof value === 'string') {
        const clean = value.replace(BAD_CHARS, '');
        if (clean !== value) onChange();
        return clean;
    }
    if (Array.isArray(value)) return value.map(v => cleanStrings(v, onChange));
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanStrings(v, onChange)]));
    return value;
}

// Аватар — только встроенная картинка: значение уходит в background-image: url(…)
export function safeAvatar(value) {
    return typeof value === 'string' && value.length <= AVATAR_MAX && AVATAR.test(value) ? value : '';
}

// Текст сообщения об исправлениях
export function fixesMessage(fixes, limit = 5) {
    const rest = fixes.length - limit;
    return ['В сохранении исправлено:', ...fixes.slice(0, limit).map(f => `• ${f}`), ...(rest > 0 ? [`и ещё ${rest}`] : [])].join('\n');
}

// Покупки характеристик: известные ключи, целые ≥ 0, характеристика расы + покупки ≤ 7
function checkStatMods(src, raceStats, fix) {
    const out = {};
    for (const [key, v] of Object.entries(src)) {
        if (!STAT_ORDER.includes(key)) { fix(`Неизвестная характеристика убрана: ${show(key)}`); continue; }
        const max = Math.max(0, STAT_MAX - (raceStats?.[key] ?? 0));
        const n = isNumber(v) ? Math.min(max, Math.max(0, Math.trunc(v))) : 0;
        if (n !== v) fix(`${STAT_LABELS[key]}: покупок ${show(v)} → ${n}`);
        out[key] = n;
    }
    return out;
}

// Ранги навыков: известные навыки, целые 1–5. Ранг 0 — запись «ранга нет» из старых версий
function checkSkillRanks(src, fix) {
    const out = {};
    for (const [name, v] of Object.entries(src)) {
        if (!SKILLS.has(name)) { fix(`Неизвестный навык убран: ${show(name)}`); continue; }
        if (v === 0) continue;
        const n = isNumber(v) ? Math.min(RANK_MAX, Math.trunc(v)) : NaN;
        if (!(n >= 1)) { fix(`Ранг навыка «${name}»: ${show(v)} — убран`); continue; }
        if (n !== v) fix(`Ранг навыка «${name}»: ${show(v)} → ${n}`);
        out[name] = n;
    }
    return out;
}

// Список навыков: известные, без повторов, не больше max
function checkSkillNames(src, label, max, fix) {
    const out = [];
    let extra = 0;
    for (const name of src) {
        if (typeof name !== 'string' || !SKILLS.has(name)) { fix(`${label}: неизвестный навык убран: ${show(name)}`); continue; }
        if (out.includes(name) || out.length >= max) { extra++; continue; }
        out.push(name);
    }
    if (extra) fix(`${label}: убрано лишних записей — ${extra}`);
    return out;
}

// Список id узлов деревьев: строки вида [a-z0-9_]+, без повторов
function checkNodeIds(src, label, fix) {
    const out = [...new Set(src.filter(id => typeof id === 'string' && NODE_ID.test(id)))];
    if (out.length !== src.length) fix(`${label}: убрано записей — ${src.length - out.length}`);
    return out;
}

// Журнал XP: строки чистым текстом не длиннее LOG_ENTRY_MAX, не больше пяти
function checkLog(src, fix) {
    // Сначала обрезка до пяти, потом очистка: разметку ищут только в записях, которые останутся
    const kept = src.filter(isLogEntry).slice(0, LOG_MAX);
    const out = kept.map(logEntryText);
    if (out.length !== src.length) fix(`Журнал XP: убрано записей — ${src.length - out.length}`);
    if (out.some((entry, i) => entry !== kept[i])) fix('Журнал XP: убрана разметка');
    return out;
}

function checkObligations(src, fix) {
    const out = [];
    let dropped = 0;
    let cut = 0;
    const extra = Math.max(0, src.length - LIMITS.obligations);
    src.slice(0, LIMITS.obligations).forEach((ob, i) => {
        if (!isObject(ob)) { dropped++; return; }
        const good = {
            id: typeof ob.id === 'string' || isNumber(ob.id) ? ob.id : i + 1,
            type: OBLIGATION_TYPES.includes(ob.type) ? ob.type : 'obligation',
            value: isCount(ob.value) ? ob.value : 10,
            desc: typeof ob.desc === 'string' ? ob.desc : '',
        };
        if (Object.keys(good).some(key => good[key] !== ob[key])) fix(`Обязательство ${out.length + 1}: исправлены поля`);
        const desc = cutText(good.desc, LIMITS.obligationDesc);
        if (desc !== good.desc) cut++;
        out.push({ ...good, desc });
    });
    if (dropped) fix(`Обязательства: убрано записей — ${dropped}`);
    if (extra) fix(`Обязательства: убрано лишних — ${extra}`);
    if (cut) fix(`Обязательства: сокращены описания — ${cut}`);
    return out;
}

// Инвентарь уже приведён к форме (normalizeInventory в migrateSession); здесь — только границы:
// не больше LIMITS.items предметов, тексты предмета не длиннее LIMITS.itemText
const ITEM_TEXTS = ['name', 'special', 'effect'];

function checkInventory(inv, fix) {
    const extra = Math.max(0, inv.items.length - LIMITS.items);
    let cut = 0;
    const items = inv.items.slice(0, LIMITS.items).map((item) => {
        let changed = false;
        const short = (text) => {
            const out = cutText(text, LIMITS.itemText);
            if (out !== text) changed = true;
            return out;
        };
        const custom = item.custom && { ...item.custom };
        if (custom) for (const key of ITEM_TEXTS) if (typeof custom[key] === 'string') custom[key] = short(custom[key]);
        const notes = short(item.notes);
        if (changed) cut++;
        return changed ? { ...item, custom, notes } : item;
    });
    if (extra) fix(`Предметы: убрано лишних — ${extra}`);
    if (cut) fix(`Предметы: сокращены тексты — ${cut}`);
    return { ...inv, items };
}

// История «Отменить»: снимки формы xp-history.js. «Отменить» переносит снимок в состояние, поэтому
// покупки в снимке проверяются теми же правилами; при любой ошибке — null (история очищается)
const SNAPSHOT_PURCHASES = ['statMods', 'skillRanks', 'purchasedTalents', 'usedTalents'];

function checkHistory(src, raceStats) {
    if (src.length > HISTORY_MAX) return null;
    let broken = false;
    const flag = () => { broken = true; };
    const out = src.map((snap) => {
        if (!isObject(snap) || !isCount(snap.earned) || !isCount(snap.spent) || !Array.isArray(snap.log)) return flag();
        const base = { earned: snap.earned, spent: snap.spent, log: checkLog(snap.log, flag) };
        // Снимок до подпроекта «покупки в истории» — только XP и журнал
        if (!SNAPSHOT_PURCHASES.some(key => Object.hasOwn(snap, key))) return base;
        if (!isObject(snap.statMods) || !isObject(snap.skillRanks) || !Array.isArray(snap.purchasedTalents) || !Array.isArray(snap.usedTalents)) return flag();
        return {
            ...base,
            statMods: checkStatMods(snap.statMods, raceStats, flag),
            skillRanks: checkSkillRanks(snap.skillRanks, flag),
            purchasedTalents: checkNodeIds(snap.purchasedTalents, '', flag),
            usedTalents: checkNodeIds(snap.usedTalents, '', flag),
        };
    });
    return broken ? null : out;
}

function checkFields(s, reference, fix) {
    const has = key => Object.hasOwn(s, key);
    const text = (key, label) => {
        if (!has(key) || typeof s[key] === 'string') return has(key) ? s[key] : '';
        fix(`${label}: значение не текст, заменено пустым`);
        return '';
    };
    // Массив или объект поля; значение другого типа — пустое, с записью в список
    const list = (key, label) => {
        if (!has(key) || Array.isArray(s[key])) return has(key) ? s[key] : [];
        fix(`${label}: значение сброшено`);
        return [];
    };
    const record = (key, label) => {
        if (!has(key) || isObject(s[key])) return has(key) ? s[key] : {};
        fix(`${label}: значение сброшено`);
        return {};
    };
    // Пара целых чисел (раны и усталость, XP): неверное значение — 0
    const pair = (key, label, parts, valid) => {
        const src = record(key, label);
        return Object.fromEntries(parts.map(([name, title]) => {
            const v = Object.hasOwn(src, name) ? src[name] : 0;
            if (valid(v)) return [name, v];
            fix(`${title}: ${show(v)} → 0`);
            return [name, 0];
        }));
    };

    const races = reference.races ?? [];
    const careers = reference.careers ?? [];
    const race = races.find(r => r.id === s.raceVal) ?? races[0];
    if (has('raceVal') && race?.id !== s.raceVal) fix(`Раса «${show(s.raceVal)}» не найдена — выбрана «${race?.name ?? '—'}»`);
    const career = careers.find(c => c.id === s.careerVal) ?? careers[0];
    if (has('careerVal') && career?.id !== s.careerVal) fix(`Карьера «${show(s.careerVal)}» не найдена — выбрана «${career?.name ?? '—'}»`);
    const specs = career?.specializations ?? [];
    const spec = specs.find(x => x.id === s.specVal) ?? specs[0];
    if (has('specVal') && spec?.id !== s.specVal) fix(`Специализация «${show(s.specVal)}» не найдена в карьере — выбрана «${spec?.name ?? '—'}»`);
    const allSpecs = new Set(careers.flatMap(c => (c.specializations ?? []).map(x => x.id)));
    const spec2 = !has('spec2Val') || s.spec2Val === NONE || allSpecs.has(s.spec2Val) ? s.spec2Val ?? NONE : null;
    if (spec2 === null) fix(`Вторая специализация «${show(s.spec2Val)}» не найдена — убрана`);
    const forceIds = new Set(reference.forcePowers ?? []);
    const force = (key) => {
        if (!has(key) || s[key] === NONE || forceIds.has(s[key])) return s[key] ?? NONE;
        fix(`Способность Силы «${show(s[key])}» не найдена — убрана`);
        return NONE;
    };

    // Длинный текст сокращается до границы, с записью в список
    const short = (key, label, max, note) => {
        const full = text(key, label);
        const out = cutText(full, max);
        if (out !== full) fix(`${label}: ${note}`);
        return out;
    };
    const save = {
        charName: short('charName', 'Имя персонажа', LIMITS.name, `сокращено до ${LIMITS.name} знаков`),
        playerNotes: short('playerNotes', 'Заметки', LIMITS.notes, `сокращены до ${LIMITS.notes} знаков`),
    };
    Object.assign(save, {
        raceVal: race?.id ?? '', careerVal: career?.id ?? '', specVal: spec?.id ?? '', spec2Val: spec2 ?? NONE,
        forceP1: force('forceP1'), forceP2: force('forceP2'),
    });

    save.charAvatar = has('charAvatar') ? safeAvatar(s.charAvatar) : '';
    if (has('charAvatar') && s.charAvatar !== '' && save.charAvatar !== s.charAvatar) fix('Аватар убран: это не картинка в допустимом формате');

    save.forceRating = !has('forceRating') || !isNumber(s.forceRating) ? 1 : Math.min(FORCE_RATING_MAX, Math.max(0, Math.trunc(s.forceRating)));
    if (has('forceRating') && save.forceRating !== s.forceRating) fix(`Рейтинг Силы: ${show(s.forceRating)} → ${save.forceRating}`);
    save.morality = has('morality') && Number.isSafeInteger(s.morality) && s.morality >= 1 && s.morality <= 100 ? s.morality : 50;
    if (has('morality') && save.morality !== s.morality) fix(`Мораль: ${show(s.morality)} → 50`);

    save.statMods = checkStatMods(record('statMods', 'Покупки характеристик'), race?.stats, fix);
    save.thresholdMods = pair('thresholdMods', 'Поправки порогов', [['wounds', 'Поправка порога ран'], ['strain', 'Поправка порога усталости']], Number.isSafeInteger);
    save.currentStatus = pair('currentStatus', 'Раны и усталость', [['wounds', 'Раны'], ['strain', 'Усталость']], isCount);
    save.xpData = pair('xpData', 'XP', [['earned', 'Полученный XP'], ['spent', 'Потраченный XP']], isCount);

    save.skillRanks = checkSkillRanks(record('skillRanks', 'Ранги навыков'), fix);
    save.selectedCareerSkills = checkSkillNames(list('selectedCareerSkills', 'Навыки со скидкой'), 'Навыки со скидкой', CAREER_SKILLS_MAX, fix);
    save.raceSkills = checkSkillNames(list('raceSkills', 'Расовые навыки'), 'Расовые навыки', Infinity, fix);
    save.purchasedTalents = checkNodeIds(list('purchasedTalents', 'Купленные таланты'), 'Купленные таланты', fix);
    save.usedTalents = checkNodeIds(list('usedTalents', 'Использованные таланты'), 'Использованные таланты', fix);

    const crits = list('criticalInjuries', 'Критические ранения');
    const keptCrits = crits.filter(c => typeof c === 'string').slice(0, CRITS_MAX);
    if (keptCrits.length !== crits.length) fix(`Критические ранения: убрано записей — ${crits.length - keptCrits.length}`);
    save.criticalInjuries = keptCrits.map(c => cutText(c, LIMITS.crit));
    const cutCrits = save.criticalInjuries.filter((c, i) => c !== keptCrits[i]).length;
    if (cutCrits) fix(`Критические ранения: сокращены тексты — ${cutCrits}`);

    save.obligations = checkObligations(list('obligations', 'Обязательства'), fix);
    save.xpLog = checkLog(list('xpLog', 'Журнал XP'), fix);
    const history = checkHistory(list('xpHistory', 'История отмены XP'), race?.stats);
    if (!history) fix('История отмены XP очищена');
    save.xpHistory = history ?? [];

    save.lightsaberChar = !has('lightsaberChar') || STAT_ORDER.includes(s.lightsaberChar) ? s.lightsaberChar ?? 'brawn' : null;
    if (save.lightsaberChar === null) {
        fix(`Характеристика светового меча: ${show(s.lightsaberChar)} → Физ. сила`);
        save.lightsaberChar = 'brawn';
    }

    // Инвентарь уже приведён к форме migrateSession (normalizeInventory) — приведение в список не
    // попадает, попадают только границы размера
    save.inventory = checkInventory(s.inventory, fix);
    save._version = SESSION_VERSION;
    // Последний шаг — по всем строкам сохранения: база не примет U+0000 и половинки суррогатных пар
    let dirty = false;
    const clean = cleanStrings(save, () => { dirty = true; });
    if (dirty) fix('Убраны недопустимые знаки');
    return clean;
}

// Разобранный JSON → сохранение текущей версии и список исправлений для пользователя. raw не
// меняется. reference — { races, careers, forcePowers } из справочников. ok: false — это не
// персонаж: не объект или нет ни одного знакомого поля
export function checkSave(raw, reference) {
    if (!isObject(raw) || !FIELDS.some(key => Object.hasOwn(raw, key))) return { ok: false };
    try {
        const fromVersion = saveVersion(raw);
        const fixes = [];
        const save = checkFields(migrateSession(structuredClone(raw)), reference ?? {}, text => fixes.push(text));
        return { ok: true, save, fixes, fromVersion };
    } catch {
        return { ok: false };
    }
}
