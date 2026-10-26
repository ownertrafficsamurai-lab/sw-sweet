// Сборка справочников из строк Supabase в форму, которую ждёт существующий код
// (бывшие DEFAULT_DB / TALENTS_DB / FORCE_DB / FORCE_LIST из app/js/data/).
// Чистая функция: без сети и DOM — тестируется в Node.
const byName = (a, b) => a.name.localeCompare(b.name, 'ru');

export function buildReferenceData({ races, careers, specializations, talentTrees, forceTrees }) {
    const specsByCareer = new Map(careers.map(c => [c.id, []]));
    for (const s of specializations) {
        const list = specsByCareer.get(s.career_id);
        if (list) list.push({ id: s.id, name: s.name, bonusSkills: s.bonus_skills, description: s.description ?? null });
    }
    return {
        races: races.map(r => ({
            id: r.id,
            name: r.name,
            stats: r.stats,
            baseWounds: r.base_wounds,
            baseStrain: r.base_strain,
            startXP: r.start_xp,
            special: r.abilities ?? '',
            skillBonus: r.skill_bonus ?? null,
            skillDiscounts: r.skill_discounts ?? null,
        })).sort(byName),
        careers: careers.map(c => ({
            id: c.id,
            name: c.name,
            careerSkills: c.career_skills,
            description: c.description ?? null,
            specializations: specsByCareer.get(c.id).sort(byName),
        })).sort(byName),
        talents: Object.fromEntries(talentTrees.map(t => [t.spec_id, t.nodes])),
        force: Object.fromEntries(forceTrees.map(f => [f.id, f.nodes])),
        forceList: [
            { id: 'none', name: '— Нет —' },
            ...forceTrees.map(f => ({ id: f.id, name: f.name })).sort(byName),
        ],
    };
}

// Каталог снаряжения (подпроект Б1): строки weapons / armor / gear по id — как в базе, без
// переименования полей (их читает inventory.js); словарь свойств item_qualities — по русскому
// названию
export function buildCatalog({ weapons, armor, gear, qualities }) {
    const byId = rows => Object.fromEntries(rows.map(r => [r.id, r]));
    return {
        weapon: byId(weapons),
        armor: byId(armor),
        gear: byId(gear),
        qualities: [...qualities].sort((a, b) => a.name_ru.localeCompare(b.name_ru, 'ru')),
    };
}
