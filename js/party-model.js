// Чистая часть дашборда мастера (4.2, спека 2026-10-14-gm-dashboard.md): карточки группы,
// подсказка «✚», соседи для ‹ › и отметка времени. Без document, сети и хранилища — тестируется в Node.
// Строка группы — ответ campaign_roster: { character_id, name, race_id, career_id, spec_id,
// player_name, is_mine }; лист — строка characters из campaign-store.js partySheets: { id, data, … };
// reference — { races, careers, forcePowers } (справочники checkSave) и catalog (CATALOG).
import { checkSave, safeAvatar } from './save-check.js';
import { displayName, initials } from './character-list-model.js';
import { sheetStats } from './sheet-stats.js';
import { vitalFill } from './hud-math.js';
import { resolveItem, catalogRow } from './inventory.js';
import { iconKey } from './item-icons.js';

// Рамка карточки подсвечивается с этой доли порога — та же граница, что у цветов полос (vitalFill)
export const HOT_PCT = 80;
// Каждое имеющееся критическое ранение — +10 к броску следующего (правило FFG)
export const CRIT_STEP = 10;
const NO_TEXT = 'Без описания';
const NO_NAME = 'Без названия';
// Строка запасов (этап 5, спека 2026-10-20-live-party-dashboard.md, п. 1): начало названия своего
// расходника без рисунка — до SHORT_MAX знаков целиком, длиннее — SHORT_CUT и «…»
const SHORT_MAX = 9;
const SHORT_CUT = 8;
const HEAL_CATEGORY = 'medical';
const BLAST_GROUP = 'explosives_ordnance';

// «Специализация» строки группы; нет в справочнике — раса
function specOrRace(row, reference) {
    const spec = reference.careers.find(c => c.id === row.career_id)?.specializations.find(s => s.id === row.spec_id)?.name;
    return spec ?? reference.races.find(r => r.id === row.race_id)?.name ?? null;
}

function vital(type, cur, max) {
    return { cur, max, ...vitalFill(type, cur, max) };
}

const atThreshold = v => !!v && v.max > 0 && v.cur >= v.max;

// Карточки в порядке группы (по вступлению). Лист проходит checkSave; нет листа в ответе (RLS не
// отдал) или он не прошёл проверку — readable: false, карточка показывает только строку группы
export function partyCards(roster, sheets, reference) {
    const byId = new Map(sheets.map(s => [s.id, s]));
    return roster.map((row) => {
        const player = row.player_name || 'игрок';
        const base = {
            id: row.character_id, mine: !!row.is_mine, player,
            sub: [row.is_mine ? 'вы' : player, specOrRace(row, reference)].filter(Boolean).join(' · '),
        };
        const sheet = byId.get(row.character_id);
        const checked = sheet ? checkSave(sheet.data, reference) : { ok: false };
        if (!checked.ok) {
            return {
                ...base, name: displayName(row.name), initials: initials(row.name), avatar: '', readable: false,
                wounds: null, strain: null, soak: null, defense: null, crits: [], hot: null, out: false, supplies: [],
            };
        }
        const save = checked.save;
        const stats = sheetStats(save, reference.races, reference.catalog);
        const wounds = stats && vital('wounds', save.currentStatus.wounds, stats.maxWounds);
        const strain = stats && vital('strain', save.currentStatus.strain, stats.maxStrain);
        return {
            ...base, name: displayName(save.charName), initials: initials(save.charName), avatar: safeAvatar(save.charAvatar), readable: true,
            wounds, strain, soak: stats ? stats.soak : null, defense: stats ? stats.defense : null,
            crits: save.criticalInjuries.map(text => text.trim() || NO_TEXT),
            hot: wounds?.pct >= HOT_PCT ? 'wounds' : strain?.pct >= HOT_PCT ? 'strain' : null,
            out: atThreshold(wounds) || atThreshold(strain),
            supplies: partySupplies(save.inventory.items, reference.catalog),
        };
    });
}

// Начало названия: по знакам (не по половинкам суррогатных пар), пробелы по краям убраны
export function shortName(name) {
    const chars = Array.from(name.trim());
    return chars.length <= SHORT_MAX ? chars.join('') : chars.slice(0, SHORT_CUT).join('').trimEnd() + '…';
}

// Группа расходника: 0 — лечение (снаряжение «Медицина»), 1 — взрывчатка (оружие «Взрывчатка и
// боеприпасы»), 2 — остальное. Сделанный своим — по оригиналу (custom.icon — id строки каталога)
function supplyGroup(item, catalog) {
    const row = item.custom ? catalogRow({ item_type: item.item_type, catalog_id: item.custom.icon }, catalog) : catalogRow(item, catalog);
    if (item.item_type === 'gear' && row?.category === HEAL_CATEGORY) return 0;
    if (item.item_type === 'weapon' && row?.weapon_group === BLAST_GROUP) return 1;
    return 2;
}

// Строка запасов карточки: расходники инвентаря (consumable) по группам, внутри — в порядке
// инвентаря. Строки одного предмета каталога — одна рамка с суммой; свои и сделанные своими — каждая
// своя. Ноль: лечение остаётся (empty), остальное не показывается. icon — ключ ITEM_ICONS; свой без
// рисунка (запасной ящик) — icon null и label — начало названия. name — полное название (для читалки)
export function partySupplies(items, catalog) {
    const byKey = new Map();
    for (const item of items) {
        if (item.consumable !== true) continue;
        const key = item.custom ? `own:${item.id}` : `${item.item_type}:${item.catalog_id}`;
        const known = byKey.get(key);
        if (known) { known.qty += item.qty; continue; }
        const view = resolveItem(item, catalog);
        const name = view.name.trim() || NO_NAME;
        const icon = iconKey(view);
        const label = view.own && icon === '_box' && view.name.trim() ? shortName(view.name) : null;
        byKey.set(key, { key, name, icon: label ? null : icon, label, qty: item.qty, group: supplyGroup(item, catalog) });
    }
    return [...byKey.values()]
        .filter(s => s.qty > 0 || s.group === 0)
        .sort((a, b) => a.group - b.group)
        .map(({ group, ...s }) => ({ ...s, heal: group === 0, empty: s.qty === 0 }));
}

// Подпись строки запасов для читалки экрана: «Стимпак: 3, Аптечка: 1»
export function suppliesText(supplies) {
    return supplies.map(s => `${s.name}: ${s.qty}`).join(', ');
}

// Подсказка «✚»: заголовок, тексты ранений по порядку и прибавка к следующему броску
export function critHint(crits) {
    return {
        title: `Критические ранения · ${crits.length}`,
        lines: [...crits],
        bonus: `+${crits.length * CRIT_STEP} к броску следующего крит. ранения`,
    };
}

// ‹ › в просмотре: соседи открытого среди читаемых чужих листов, без круга. index — с нуля
// (-1 — открытого среди них нет), total — сколько их; prev / next — id или null
export function flipTargets(cards, currentId) {
    const list = cards.filter(c => c.readable && !c.mine);
    const index = list.findIndex(c => c.id === currentId);
    return {
        prev: index > 0 ? list[index - 1].id : null,
        next: index >= 0 && index < list.length - 1 ? list[index + 1].id : null,
        index, total: list.length,
    };
}

// Отметка над карточками (этап 5, п. 4, макет live-states.html — A): связь есть — «Актуально»,
// нет — «нет связи · с 19:42» (местное время последних данных). label — доступное имя кнопки
export function liveLabel(live, at) {
    if (live) return { text: 'Актуально', label: 'Обновить группу — данные актуальны' };
    const time = `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`;
    return { text: `нет связи · с ${time}`, label: `Обновить группу — нет связи с ${time}` };
}

// Всё, что видно на карточке, кроме портрета (его — сравнением строк, без копирования в JSON)
const shown = c => JSON.stringify([c.name, c.initials, c.sub, c.readable, c.wounds, c.strain, c.soak, c.defense, c.crits, c.hot, c.out, c.supplies]);

// Вспышка (этап 5, п. 3): id карточек after, у которых видимое отличается от before, и новых
export function changedCards(before, after) {
    const old = new Map(before.map(c => [c.id, c]));
    return after.filter((c) => {
        const was = old.get(c.id);
        return !was || was.avatar !== c.avatar || shown(was) !== shown(c);
    }).map(c => c.id);
}
