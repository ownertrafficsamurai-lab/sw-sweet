// Словарь навыков — ровно те названия, что используют справочники Supabase
// (careers.career_skills / specializations.bonus_skills). Статус «карьерный»
// определяется точным совпадением строки, поэтому расхождение хотя бы в одной
// букве молча отключает скидку на XP — это проверяет tests/skills.test.js.
export const ALL_SKILLS = [
    { name: "Астронавигация", char: "intellect" }, { name: "Атлетика", char: "brawn" },
    { name: "Внимательность", char: "cunning" }, { name: "Воровство", char: "cunning" },
    { name: "Выживание", char: "cunning" }, { name: "Готовность", char: "willpower" },
    { name: "Запугивание", char: "willpower" }, { name: "Знание улиц", char: "cunning" },
    { name: "Компьютеры", char: "intellect" }, { name: "Координация", char: "agility" },
    { name: "Лидерство", char: "presence" }, { name: "Медицина", char: "intellect" },
    { name: "Механика", char: "intellect" }, { name: "Обаяние", char: "presence" },
    { name: "Обман", char: "cunning" }, { name: "Переговоры", char: "presence" },
    { name: "Пилотирование (Космическое)", char: "agility" }, { name: "Пилотирование (Планетарное)", char: "agility" },
    { name: "Скрытность", char: "agility" }, { name: "Стойкость", char: "brawn" },
    { name: "Характер", char: "willpower" }, { name: "Хладнокровие", char: "presence" },
    { name: "Знание (Внешнее кольцо)", char: "intellect" }, { name: "Знание (Военное дело)", char: "intellect" },
    { name: "Знание (Ксенология)", char: "intellect" }, { name: "Знание (Мифы и легенды)", char: "intellect" },
    { name: "Знание (Образование)", char: "intellect" }, { name: "Знание (Преступный мир)", char: "intellect" },
    { name: "Знание (Центральные миры)", char: "intellect" },
    { name: "Артиллерия", char: "agility" }, { name: "Ближний бой", char: "brawn" },
    { name: "Драка", char: "brawn" }, { name: "Световой меч", char: "brawn" },
    { name: "Стрельба (Лёгкое)", char: "agility" }, { name: "Стрельба (Тяжёлое)", char: "agility" }
].sort((a,b) => a.name.localeCompare(b.name));

export const COMBAT_SKILLS_LIST = ["Световой меч", "Драка", "Ближний бой", "Артиллерия", "Стрельба (Лёгкое)", "Стрельба (Тяжёлое)"];

// Пул проверки навыка (строка навыка на листе и оружие на «Снаряжении»): кубиков — большее из
// характеристики и ранга, из них жёлтых (мастерства) — меньшее
export function dicePool(charVal, rank) {
    const yellow = Math.min(charVal, rank);
    return { yellow, green: Math.max(charVal, rank) - yellow };
}

// Характеристика навыка; у «Светового меча» — выбранная игроком (state.lightsaberChar), а если в
// сохранении неизвестное значение — Физ. сила, как у светового меча по умолчанию
const CHARACTERISTIC_KEYS = new Set(ALL_SKILLS.map(s => s.char));
export function skillChar(name, lightsaberChar) {
    if (name === 'Световой меч') return CHARACTERISTIC_KEYS.has(lightsaberChar) ? lightsaberChar : 'brawn';
    return ALL_SKILLS.find(s => s.name === name)?.char ?? null;
}

// Пул навыка персонажа: характеристика, её значение, ранг и кубики; null — навыка нет в словаре
// (или не задан) либо характеристика неизвестна
export function skillPool(name, { finalStats, skillRanks, lightsaberChar }) {
    const charKey = skillChar(name, lightsaberChar);
    const charVal = charKey ? finalStats[charKey] : undefined;
    if (charVal === undefined) return null;
    const rank = skillRanks[name] || 0;
    return { charKey, charVal, rank, ...dicePool(charVal, rank) };
}

// «Знание (…)» — семь навыков знаний; «Знание улиц» к ним не относится
export function isKnowledgeSkill(name) {
    return name.startsWith('Знание (');
}

// Таблица листа для навыка: 'combat', 'knowledge' или 'general'. «Знания» — отдельная таблица
// только на компьютере (split, А3 часть 2); на телефоне они в «Общих» по алфавиту, как раньше
export function skillTable(name, split) {
    if (COMBAT_SKILLS_LIST.includes(name)) return 'combat';
    return split && isKnowledgeSkill(name) ? 'knowledge' : 'general';
}

// Старые названия (MVP и v2 до подпроекта 3a) → названия из базы.
export const LEGACY_SKILL_RENAMES = {
    "Дисциплина": "Характер",
    "Уличное чутьё": "Знание улиц",
    "Пилотирование (Космос)": "Пилотирование (Космическое)",
    "Холодное оружие": "Ближний бой",
    "Знание (Война)": "Знание (Военное дело)",
    "Знание (Преступность)": "Знание (Преступный мир)",
    "Знание (Вселенная)": "Знание (Внешнее кольцо)",
};

// Переименовывает старые навыки в сохранённой сессии. Если у персонажа есть и старое,
// и новое имя одного навыка, остаётся больший ранг. Мутирует и возвращает session.
export function renameLegacySkills(session) {
    const ranks = session.skillRanks;
    if (ranks && typeof ranks === 'object') {
        for (const [oldName, newName] of Object.entries(LEGACY_SKILL_RENAMES)) {
            if (!Object.prototype.hasOwnProperty.call(ranks, oldName)) continue;
            ranks[newName] = Math.max(ranks[oldName] || 0, ranks[newName] || 0);
            delete ranks[oldName];
        }
    }
    if (Array.isArray(session.selectedCareerSkills)) {
        session.selectedCareerSkills = [...new Set(session.selectedCareerSkills.map(n => LEGACY_SKILL_RENAMES[n] || n))];
    }
    return session;
}
