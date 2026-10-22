// Инвентарь персонажа (подпроект Б1, спека 2026-09-30-equipment-catalog.md, часть Б1): предметы из
// каталога weapons / armor / gear или свои, надетая броня, расходники, нагрузка, свойства оружия.
// Чистые функции: без DOM, сети и хранилища — тестируются в Node (tests/inventory.test.js).
// catalog — CATALOG из reference-data.js: { weapon, armor, gear } — строки таблиц по id,
// qualities — строки item_qualities.
import { COMBAT_SKILLS_LIST } from './skills.js';
import { isCatalogIcon } from './item-icons.js';

export const ITEM_TYPES = ['weapon', 'armor', 'gear'];

// Дистанции — сокращения прежнего инвентаря
export const RANGE_LABELS = { engaged: 'Ближн', short: 'Коротк', medium: 'Средн', long: 'Дальн', extreme: 'Экстр', planetary: 'Планет' };
// Ключ из файла ищется только среди своих ключей объекта: «constructor» или «__proto__» из
// импортированного сохранения не должны находить члены Object.prototype
const ownKey = (obj, key) => (obj && typeof key === 'string' && Object.hasOwn(obj, key) ? obj[key] : undefined);
const rangeKey = r => (ownKey(RANGE_LABELS, r) ? r : 'engaged');

// Группы окна «+ Добавить» в порядке показа: оружие — по weapon_group, снаряжение — по category
export const WEAPON_GROUPS = [
    { key: 'energy_weapons', label: 'Энергетическое оружие' },
    { key: 'slugthrowers', label: 'Огнестрельное оружие' },
    { key: 'explosives_ordnance', label: 'Взрывчатка' },
    { key: 'brawl_weapons', label: 'Оружие для драки' },
    { key: 'melee_weapons', label: 'Оружие ближнего боя' },
    { key: 'lightsabers', label: 'Световые мечи' },
];
export const GEAR_CATEGORIES = [
    { key: 'communications', label: 'Связь' },
    { key: 'scanning_surveillance', label: 'Сканеры и наблюдение' },
    { key: 'medical', label: 'Медицина' },
    { key: 'cybernetics', label: 'Кибернетика' },
    { key: 'drugs_poisons', label: 'Препараты и яды' },
    { key: 'security', label: 'Безопасность' },
    { key: 'survival', label: 'Выживание' },
    { key: 'tools_electronics', label: 'Инструменты и электроника' },
];

// Правило расходника (спека А, «Решения для подпроекта Б»)
const CONSUMABLE_GEAR_CATEGORIES = ['medical', 'drugs_poisons'];
const CONSUMABLE_GEAR_IDS = ['extra_reload'];
const THROWN_WEAPON_GROUP = 'explosives_ordnance';
// Надетая броня весит на 3 меньше
const WORN_ARMOR_RELIEF = 3;

const list = v => (Array.isArray(v) ? v : []);
const text = v => (typeof v === 'string' ? v : v == null ? '' : String(v));
const count = v => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(0, n) : 0; };
const optional = (v, min) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(min, n) : null; };

// Число из поля ввода: пустое поле — null, если optional, иначе 0; меньше min — min
export function readNumber(value, { min = 0, optional: canBeEmpty = false } = {}) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return canBeEmpty ? null : min;
    return Math.max(min, n);
}

export function emptyInventory() {
    return { credits: 0, items: [] };
}

// Новый id — «i-N», на единицу больше наибольшего N среди предметов
export function nextItemId(items) {
    let max = 0;
    for (const item of items) {
        const n = /^i-(\d+)$/.exec(item.id ?? '');
        if (n) max = Math.max(max, Number(n[1]));
    }
    return `i-${max + 1}`;
}

function makeItem(id, itemType, fields) {
    return { id, item_type: itemType, catalog_id: null, qty: 1, custom: null, notes: '', worn: false, consumable: false, ...fields };
}

// Старое сохранение (weapons[], equipment[], armorVal) → { credits, items }. Всё становится своими
// предметами; ненулевая броня — надетой своей бронёй, чтобы поглощение персонажа не изменилось.
export function migrateInventory(old, armorVal) {
    const items = [];
    const add = (itemType, fields) => items.push(makeItem(`i-${items.length + 1}`, itemType, fields));
    for (const w of list(old?.weapons)) {
        add('weapon', { custom: {
            name: text(w?.name), skill: null, damage: count(w?.damage), damage_adds_brawn: false,
            crit: optional(w?.crit, 1), range: rangeKey(w?.range),
            encumbrance: count(w?.enc), special: text(w?.special),
        } });
    }
    for (const e of list(old?.equipment)) {
        add('gear', { qty: count(e?.qty ?? 1), notes: text(e?.notes), custom: { name: text(e?.name), encumbrance: count(e?.enc), effect: '' } });
    }
    const armor = count(armorVal);
    if (armor > 0) add('armor', { worn: true, custom: { name: 'Броня', defense: 0, soak: armor, encumbrance: 0 } });
    return { credits: count(old?.credits), items };
}

// icon — рисунок оригинала у предмета, «сделанного своим» (item-icons.js): поле есть, только когда
// это рисунок предмета каталога
function withIcon(fields, icon) {
    return isCatalogIcon(icon) ? { ...fields, icon } : fields;
}

function customFields(itemType, c) {
    if (itemType === 'weapon') {
        return withIcon({
            name: text(c.name), skill: COMBAT_SKILLS_LIST.includes(c.skill) ? c.skill : null, damage: count(c.damage),
            damage_adds_brawn: c.damage_adds_brawn === true, crit: optional(c.crit, 1),
            range: rangeKey(c.range), encumbrance: count(c.encumbrance), special: text(c.special),
        }, c.icon);
    }
    if (itemType === 'armor') {
        return withIcon({ name: text(c.name), defense: count(c.defense), soak: count(c.soak), encumbrance: count(c.encumbrance) }, c.icon);
    }
    return withIcon({ name: text(c.name), encumbrance: optional(c.encumbrance, 0), effect: text(c.effect) }, c.icon);
}

// Сохранение нового вида (свой файл, импорт) → та же форма, что пишет приложение: предметы без
// типа или без каталога и своих статов отброшены, поля приведены к своим типам, id — уникальные
// строки, надета не больше одной брони.
export function normalizeInventory(inv) {
    const items = [];
    const seen = new Set();
    let wornTaken = false;
    for (const raw of list(inv?.items)) {
        if (!raw || typeof raw !== 'object' || !ITEM_TYPES.includes(raw.item_type)) continue;
        const custom = raw.custom && typeof raw.custom === 'object' ? customFields(raw.item_type, raw.custom) : null;
        const catalogId = !custom && typeof raw.catalog_id === 'string' && raw.catalog_id ? raw.catalog_id : null;
        if (!custom && !catalogId) continue;
        const id = typeof raw.id === 'string' && raw.id && !seen.has(raw.id) ? raw.id : null;
        if (id) seen.add(id);
        const worn = raw.item_type === 'armor' && raw.worn === true && !wornTaken;
        if (worn) wornTaken = true;
        items.push(makeItem(id, raw.item_type, {
            catalog_id: catalogId, qty: count(raw.qty ?? 1), custom, notes: text(raw.notes), worn, consumable: raw.consumable === true,
        }));
    }
    // Наибольший «i-N» ищется один раз: поиск заново для каждого предмета без id — квадрат от
    // числа предметов (файл на десятки тысяч предметов вешал загрузку)
    let next = Number(nextItemId(items).slice(2));
    for (const item of items) if (!item.id) item.id = `i-${next++}`;
    return { credits: count(inv?.credits), items };
}

export function catalogRow(item, catalog) {
    return ownKey(ownKey(catalog, item.item_type), item.catalog_id) ?? null;
}

// Единый вид предмета для отрисовки: статы из каталога или из custom; own — свой, missing — нет в
// каталоге. special — массив строк каталога («Pierce 2») или текст своего предмета; note / effect
// каталога — тексты базы знаний со значками formatDesc, effect своего — ввод пользователя.
export function resolveItem(item, catalog) {
    const view = {
        id: item.id, type: item.item_type, qty: item.qty, notes: item.notes, worn: item.worn, consumable: item.consumable,
        own: false, missing: false, icon: null, name: '', encumbrance: 0,
        skill: null, damage: null, damageAddsBrawn: false, crit: null, range: null, special: [],
        defense: 0, soak: 0, effect: '', note: '', price: null, rarity: null, restricted: false, group: null,
    };
    if (item.custom) {
        const c = item.custom;
        Object.assign(view, { own: true, icon: c.icon ?? null, name: c.name, encumbrance: c.encumbrance ?? null });
        if (view.type === 'weapon') Object.assign(view, { skill: c.skill, damage: c.damage, damageAddsBrawn: c.damage_adds_brawn, crit: c.crit, range: c.range, special: c.special });
        if (view.type === 'armor') Object.assign(view, { defense: c.defense, soak: c.soak });
        if (view.type === 'gear') view.effect = c.effect;
        return view;
    }
    const row = catalogRow(item, catalog);
    if (!row) return Object.assign(view, { missing: true, name: 'Предмет не найден в каталоге' });
    Object.assign(view, { icon: item.catalog_id, name: row.name, encumbrance: row.encumbrance ?? null, price: row.price, rarity: row.rarity, restricted: row.restricted === true });
    if (view.type === 'weapon') {
        Object.assign(view, {
            skill: row.skill, damage: row.damage, damageAddsBrawn: row.damage_adds_brawn === true, crit: row.crit ?? null,
            range: row.range, special: list(row.special), note: text(row.note), group: row.weapon_group,
        });
    }
    if (view.type === 'armor') Object.assign(view, { defense: row.defense, soak: row.soak });
    if (view.type === 'gear') Object.assign(view, { effect: text(row.effect), group: row.category });
    return view;
}

// Нагрузка строки: груз × количество; у надетой брони один экземпляр весит на 3 меньше (не ниже 0);
// груз «—» (null), нет в каталоге или количество 0 — 0
export function itemEncumbrance(view) {
    const enc = view.encumbrance ?? 0;
    if (view.qty <= 0) return 0;
    if (view.type === 'armor' && view.worn) return Math.max(0, enc - WORN_ARMOR_RELIEF) + (view.qty - 1) * enc;
    return enc * view.qty;
}

export function totalEncumbrance(items, catalog) {
    return items.reduce((sum, item) => sum + itemEncumbrance(resolveItem(item, catalog)), 0);
}

// Надетая броня (вид resolveItem) или null; броня, которой нет в каталоге, не защищает
export function wornArmor(items, catalog) {
    const item = items.find(it => it.item_type === 'armor' && it.worn);
    if (!item) return null;
    const view = resolveItem(item, catalog);
    return view.missing ? null : view;
}

// Урон оружия: у рукопашного (damageAddsBrawn) — плюс Физ. сила; null — урона нет
export function weaponDamage(view, brawn) {
    if (view.damage == null) return null;
    return view.damage + (view.damageAddsBrawn ? brawn : 0);
}

export function critLabel(crit) {
    return crit == null ? '—' : String(crit);
}

export function isConsumableByCatalog(itemType, row) {
    if (itemType === 'gear') return CONSUMABLE_GEAR_CATEGORIES.includes(row.category) || CONSUMABLE_GEAR_IDS.includes(row.id);
    if (itemType === 'weapon') return row.weapon_group === THROWN_WEAPON_GROUP;
    return false;
}

// Надпись кнопки расходника: у оружия группы «Взрывчатка» — «Бросить», у остальных — «Исп.»
export function useLabel(view) {
    return view.type === 'weapon' && view.group === THROWN_WEAPON_GROUP ? 'Бросить' : 'Исп.';
}

// Добавление из каталога. Расходник, чей catalog_id уже есть среди предметов того же типа, даёт
// qty + 1 той строке (merged); остальное — новая строка. Возвращает новый массив и id строки.
export function addFromCatalog(items, itemType, row) {
    const consumable = isConsumableByCatalog(itemType, row);
    const same = consumable && items.find(it => it.item_type === itemType && it.catalog_id === row.id);
    if (same) return { items: items.map(it => (it === same ? { ...it, qty: it.qty + 1 } : it)), id: same.id, merged: true };
    const id = nextItemId(items);
    return { items: [...items, makeItem(id, itemType, { catalog_id: row.id, consumable })], id, merged: false };
}

const EMPTY_CUSTOM = {
    weapon: { name: '', skill: null, damage: 0, damage_adds_brawn: false, crit: null, range: 'engaged', encumbrance: 0, special: '' },
    armor: { name: '', defense: 0, soak: 0, encumbrance: 0 },
    gear: { name: '', encumbrance: 0, effect: '' },
};

// Пустой свой предмет («✎ Своё …» окна добавления)
export function newCustomItem(items, itemType) {
    const id = nextItemId(items);
    return { items: [...items, makeItem(id, itemType, { custom: { ...EMPTY_CUSTOM[itemType] } })], id };
}

// «Сделать своим»: статы каталога — в custom (свойства — русскими названиями через запятую),
// связь с каталогом рвётся, рисунок оригинала остаётся (custom.icon); id, qty, заметки, «Надета» и
// «расходуемый» остаются
export function makeCustom(item, catalog) {
    const row = catalogRow(item, catalog);
    if (item.custom || !row) return item;
    let custom;
    if (item.item_type === 'weapon') {
        custom = {
            name: row.name, skill: row.skill ?? null, damage: row.damage, damage_adds_brawn: row.damage_adds_brawn === true,
            crit: row.crit ?? null, range: row.range, encumbrance: row.encumbrance,
            special: parseQualities(list(row.special), catalog.qualities).map(qualityLabel).join(', '),
        };
    } else if (item.item_type === 'armor') {
        custom = { name: row.name, defense: row.defense, soak: row.soak, encumbrance: row.encumbrance };
    } else {
        custom = { name: row.name, encumbrance: row.encumbrance ?? null, effect: text(row.effect) };
    }
    return { ...item, catalog_id: null, custom: withIcon(custom, row.id) };
}

export function useItem(item) {
    return { ...item, qty: Math.max(0, item.qty - 1) };
}

// «Надеть» снимает «Надета» с другой брони; «Снять» — только с этой
export function wearArmor(items, id, worn) {
    return items.map(it => {
        if (it.item_type !== 'armor') return it;
        const next = worn ? it.id === id : it.id === id ? false : it.worn;
        return next === it.worn ? it : { ...it, worn: next };
    });
}

export function removeItem(items, id) {
    return items.filter(it => it.id !== id);
}

export function countWeapons(items) {
    return items.filter(it => it.item_type === 'weapon').length;
}

const norm = s => text(s).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

// Свойства: массив каталога ("Limited Ammo 6") ищется по name_en; текст своего предмета делится по
// запятым, каждый кусок ищется по name_ru и name_en без учёта регистра (и «ё/е»), число в конце —
// ранг. Нераспознанный кусок остаётся текстом (quality: null).
export function parseQualities(special, dict) {
    const exact = new Map(dict.map(q => [q.name_en, q]));
    const loose = new Map(dict.flatMap(q => [[norm(q.name_en), q], [norm(q.name_ru), q]]));
    const pieces = Array.isArray(special) ? special : text(special).split(',');
    const found = [];
    for (const piece of pieces) {
        const raw = text(piece).trim();
        if (!raw) continue;
        const [, name, rank] = /^(.*?)(?:\s+(\d+))?$/.exec(raw);
        const quality = (Array.isArray(special) && exact.get(name)) || loose.get(norm(name)) || null;
        found.push(quality ? { quality, rank: rank === undefined ? null : Number(rank), text: raw } : { quality: null, rank: null, text: raw });
    }
    return found;
}

export function qualityLabel(parsed) {
    if (!parsed.quality) return parsed.text;
    return parsed.rank == null ? parsed.quality.name_ru : `${parsed.quality.name_ru} ${parsed.rank}`;
}

// Страница оригинала без пути к файлу: «Force and Destiny Core, Item Qualities, стр. 161»
export function qualitySource(quality) {
    return text(quality.source).split(' (')[0].replace(/\.$/, '');
}

// Поиск окна «+ Добавить»: подстрока названия без учёта регистра и «ё/е»
export function matchesQuery(name, query) {
    return norm(name).includes(norm(query));
}

// Список окна «+ Добавить»: группы в порядке WEAPON_GROUPS / GEAR_CATEGORIES (незнакомые — в
// «Прочее» в конце), внутри — по названию; броня — одна группа без подписи; пустые группы убраны
export function catalogGroups(itemType, catalog, query = '') {
    const rows = Object.values(catalog[itemType] ?? {})
        .filter(r => matchesQuery(r.name, query))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    if (itemType === 'armor') return rows.length ? [{ key: 'armor', label: null, rows }] : [];
    const groups = itemType === 'weapon' ? WEAPON_GROUPS : GEAR_CATEGORIES;
    const field = itemType === 'weapon' ? 'weapon_group' : 'category';
    const known = new Set(groups.map(g => g.key));
    const out = groups.map(g => ({ key: g.key, label: g.label, rows: rows.filter(r => r[field] === g.key) }));
    out.push({ key: 'other', label: 'Прочее', rows: rows.filter(r => !known.has(r[field])) });
    return out.filter(g => g.rows.length);
}
