import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { buildReferenceData, buildCatalog } from './reference-shape.js';

// Справочники из Supabase в прежней форме (бывшие TALENTS_DB / FORCE_DB / FORCE_LIST
// из app/js/data/). Объекты пустые до loadReferenceData() и заполняются на месте,
// поэтому модули, которые их импортируют, сразу видят загруженные данные.
export const TALENTS_DB = {};
export const FORCE_DB = {};
export const FORCE_LIST = [];
// Каталог снаряжения и словарь свойств (подпроект Б1): { weapon, armor, gear } — строки таблиц
// по id, qualities — строки item_qualities (inventory.js)
export const CATALOG = { weapon: {}, armor: {}, gear: {}, qualities: [] };

// У запросов supabase-js нет своего таймаута — без него экран загрузки висел бы вечно.
const TIMEOUT_MS = 20000;

const TABLES = [
    ['races', 'id, name, stats, base_wounds, base_strain, start_xp, abilities, skill_bonus'],
    ['careers', 'id, name, career_skills, description'],
    ['specializations', 'id, career_id, name, bonus_skills, description'],
    ['talent_trees', 'spec_id, nodes'],
    ['force_trees', 'id, name, nodes'],
    ['weapons', 'id, name, category, weapon_group, skill, damage, damage_adds_brawn, crit, range, encumbrance, price, restricted, rarity, special, note'],
    ['armor', 'id, name, defense, soak, price, encumbrance, restricted, rarity'],
    ['gear', 'id, name, category, price, encumbrance, restricted, rarity, effect'],
    ['item_qualities', 'id, name_en, name_ru, ranked, description, source'],
];

function loadError(kind, cause) {
    const error = new Error(`Не удалось загрузить справочники (${kind})`, { cause });
    error.kind = kind;
    return error;
}

function replaceContents(target, source) {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, source);
}

export async function loadReferenceData() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let results;
    try {
        results = await Promise.all(TABLES.map(([table, columns]) =>
            supabase.from(table).select(columns).abortSignal(controller.signal)));
    } catch (e) {
        throw loadError('network', e);
    } finally {
        clearTimeout(timer);
    }
    const failed = results.find(r => r.error);
    if (failed) throw loadError('network', failed.error);

    const [races, careers, specializations, talentTrees, forceTrees, weapons, armor, gear, qualities] = results.map(r => r.data);
    // При истёкшей сессии запрос уходит без пользователя, и RLS отдаёт пустой список, а не ошибку
    if (!races.length || !careers.length) throw loadError('empty');

    // Раскладываем только при полном успехе — наполовину заполненного состояния не бывает
    const shaped = buildReferenceData({ races, careers, specializations, talentTrees, forceTrees });
    replaceContents(TALENTS_DB, shaped.talents);
    replaceContents(FORCE_DB, shaped.force);
    FORCE_LIST.length = 0;
    FORCE_LIST.push(...shaped.forceList);
    state.db = { races: shaped.races, careers: shaped.careers };
    Object.assign(CATALOG, buildCatalog({ weapons, armor, gear, qualities }));
}
