import { ALL_SKILLS } from './skills.js';
import { STAT_ORDER } from './stat-info.js';

// Строки окон выбора расы, карьеры и специализации (подпроект 3b, choice-picker.js) из
// справочников state.db. Строка: { kind, id, name, note, noteTone, cells, disabled, … } — шесть
// ячеек cells идут в порядке STAT_ORDER: у расы — значение характеристики, у карьеры и
// специализации — сколько её навыков приходится на характеристику.
// Модуль чистый: не трогает document, window и localStorage — его импортируют тесты в Node.

// Карьера «Универсальный» базы — не карьера персонажа, а набор универсальных специализаций:
// в окне карьеры её нет, в окне второй специализации она — последний раздел «Универсальные»
export const UNIVERSAL_CAREER = 'universal';
const UNIVERSAL_LABEL = 'Универсальные';
const BASE_XP = 100;

const byName = (a, b) => a.name.localeCompare(b.name, 'ru');
// Поиск без учёта регистра и «ё/е» — как в окне «+ Добавить» (inventory.js)
const norm = s => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const SKILL_CHAR = new Map(ALL_SKILLS.map(s => [s.name, s.char]));

// Навыки с их характеристикой; навыка нет в словаре приложения — char: null (точка без цвета)
export function skillList(names) {
    return (names || []).map(name => ({ name, char: SKILL_CHAR.get(name) ?? null }));
}

// Сколько навыков приходится на каждую характеристику; навык не из словаря не считается
export function skillCounts(names) {
    const counts = Object.fromEntries(STAT_ORDER.map(key => [key, 0]));
    for (const { char } of skillList(names)) if (char) counts[char] += 1;
    return counts;
}

// Тон приписки «N XP»: обычные 100 — 'base', меньше — 'low', больше — 'high'
export function xpTone(startXP) {
    if (startXP > BASE_XP) return 'high';
    return startXP < BASE_XP ? 'low' : 'base';
}

// Ячейки расы: 3 и больше — 'strong', единица — 'dim', остальное — 'plain'
const statCells = stats => STAT_ORDER.map(key => {
    const value = stats?.[key] ?? 0;
    return { key, text: String(value), tone: value >= 3 ? 'strong' : value <= 1 ? 'dim' : 'plain' };
});

// Ячейки карьеры (strongFrom 3) и специализации (strongFrom 2): ноль — приглушённая точка
const countCells = (names, strongFrom) => {
    const counts = skillCounts(names);
    return STAT_ORDER.map(key => {
        const n = counts[key];
        return { key, text: n === 0 ? '·' : String(n), tone: n === 0 ? 'dim' : n >= strongFrom ? 'strong' : 'plain' };
    });
};

// Пороги — по формулам листа (getDerivedStats): база расы + стартовая характеристика расы
function raceRow(race) {
    const threshold = (base, stat) => ({ total: base + stat, base, stat });
    return {
        kind: 'race', id: race.id, name: race.name,
        note: `${race.startXP} XP`, noteTone: xpTone(race.startXP),
        cells: statCells(race.stats), disabled: false,
        wounds: threshold(race.baseWounds, race.stats?.brawn ?? 0),
        strain: threshold(race.baseStrain, race.stats?.willpower ?? 0),
        startXP: race.startXP, special: race.special || '',
    };
}

function careerRow(career) {
    const specs = career.specializations || [];
    return {
        kind: 'career', id: career.id, name: career.name,
        note: `${specs.length} спек.`, noteTone: 'base',
        cells: countCells(career.careerSkills, 3), disabled: false,
        description: career.description || '',
        skills: skillList(career.careerSkills),
        specNames: specs.map(s => s.name),
    };
}

// note — почему строку нельзя выбрать («основная специализация» / «вторая специализация»)
function specRow(spec, note = '') {
    return {
        kind: 'spec', id: spec.id, name: spec.name,
        note, noteTone: 'base',
        cells: countCells(spec.bonusSkills, 2), disabled: !!note,
        description: spec.description || '',
        skills: skillList(spec.bonusSkills),
    };
}

// Текущий выбор — отдельно (блок «Сейчас выбрана»), в списке его нет; остальные — по алфавиту
function split(rows, currentId) {
    const sorted = [...rows].sort(byName);
    return {
        current: sorted.find(r => r.id === currentId) ?? null,
        rows: sorted.filter(r => r.id !== currentId),
    };
}

export function raceView(races, currentId) {
    return split(races.map(raceRow), currentId);
}

export function careerView(careers, currentId) {
    return split(careers.filter(c => c.id !== UNIVERSAL_CAREER || c.id === currentId).map(careerRow), currentId);
}

// Специализации одной карьеры. pin — показать основную (specId) блоком «Сейчас выбрана»; на шаге
// «карьера → специализация» блока нет (pin: false). Вторая специализация не выбирается.
export function specView(careers, careerId, { specId, spec2Id, pin = true } = {}) {
    const career = careers.find(c => c.id === careerId);
    const rows = (career?.specializations || []).map(s => specRow(s, s.id === spec2Id ? 'вторая специализация' : ''));
    return { careerName: career?.name ?? '', ...split(rows, pin ? specId : null) };
}

// Вторая специализация: разделы по карьерам — первой карьера персонажа (own), остальные по
// алфавиту, последним «Универсальные». Основная специализация не выбирается. С поиском остаются
// только разделы с совпадениями; пустых разделов нет.
export function spec2View(careers, { careerId, specId, spec2Id, query = '' } = {}) {
    const q = norm(query);
    const rank = c => (c.id === careerId ? 0 : c.id === UNIVERSAL_CAREER ? 2 : 1);
    let current = null;
    const sections = [...careers].sort((a, b) => rank(a) - rank(b) || byName(a, b)).map(career => {
        const rows = [];
        for (const spec of [...(career.specializations || [])].sort(byName)) {
            if (spec.id === spec2Id) { current = specRow(spec); continue; }
            if (q && !norm(spec.name).includes(q)) continue;
            rows.push(specRow(spec, spec.id === specId ? 'основная специализация' : ''));
        }
        return {
            id: career.id,
            name: career.id === UNIVERSAL_CAREER ? UNIVERSAL_LABEL : career.name,
            own: career.id === careerId,
            rows,
        };
    }).filter(section => section.rows.length > 0);
    return { current, sections, searching: q !== '' };
}

// Карьера и специализация по id специализации (подписи полей, тексты подтверждений); null — нет
export function findSpec(careers, specId) {
    for (const career of careers) {
        const spec = (career.specializations || []).find(s => s.id === specId);
        if (spec) return { career, spec };
    }
    return null;
}

// Соседняя строка для стрелок ↑/↓ на компьютере: delta −1 / +1, на краях — та же строка
export function neighborId(ids, id, delta) {
    const at = ids.indexOf(id);
    if (at === -1) return ids[0] ?? null;
    return ids[Math.min(ids.length - 1, Math.max(0, at + delta))];
}
