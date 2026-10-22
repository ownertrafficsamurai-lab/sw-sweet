import { ALL_SKILLS } from './skills.js';

// Бесплатные ранги навыков от расы (спека 2026-10-01-race-free-skill-ranks.md). У расы в справочнике
// поле skillBonus: { fixed: [навыки] } | { choose: N, from: [навыки] | 'non_career' } | null.
// Расовые навыки персонажа — фиксированные расы и выбранные игроком (state.raceSkills). У каждого
// из них ранг не ниже 1, и этот первый ранг не покупается и не возвращается; state.skillRanks
// по-прежнему хранит полный ранг. Модуль чистый: не трогает document, window и localStorage —
// его импортируют тесты в Node.
const KNOWN = new Set(ALL_SKILLS.map(s => s.name));
const known = names => (Array.isArray(names) ? names.filter(n => KNOWN.has(n)) : []);
const NONE = { fixed: [], choose: 0, from: [] };

// Поле расы в нормальной форме. Неизвестные навыки пропускаются; выбор без вариантов не предлагается
export function raceBonus(race) {
    const bonus = race?.skillBonus;
    if (!bonus || typeof bonus !== 'object') return { ...NONE };
    const fixed = known(bonus.fixed);
    const from = bonus.from === 'non_career' ? 'non_career' : known(bonus.from);
    const choose = Number.isInteger(bonus.choose) && bonus.choose > 0 && from.length ? bonus.choose : 0;
    return { fixed, choose, from: choose ? from : [] };
}

// Действительный выбор игрока: разные навыки из допустимых, не больше, чем даёт раса
export function chosenRaceSkills(race, raceSkills) {
    const { choose, from } = raceBonus(race);
    if (!choose) return [];
    const allowed = from === 'non_career' ? KNOWN : new Set(from);
    return [...new Set(known(raceSkills))].filter(n => allowed.has(n)).slice(0, choose);
}

export function raceSkillNames(race, raceSkills) {
    return [...new Set([...raceBonus(race).fixed, ...chosenRaceSkills(race, raceSkills)])];
}

export function needsRaceChoice(race, raceSkills) {
    return chosenRaceSkills(race, raceSkills).length < raceBonus(race).choose;
}

// Подпись поля «Расовые навыки»: выбранные навыки или приглашение выбрать
export function raceChoiceLabel(race, raceSkills) {
    const { choose, from } = raceBonus(race);
    const chosen = chosenRaceSkills(race, raceSkills);
    if (chosen.length === choose) return chosen.join(', ');
    return from === 'non_career' ? `Выберите ${choose} навыка` : `Выберите ${choose} из ${from.length}`;
}

// Варианты для окна выбора. У «любых некарьерных» — все навыки; карьерные навыки карьеры и
// бонусные навыки основной специализации помечены и недоступны для нового выбора
export function raceChoiceOptions(race, { careerSkills = [], specSkills = [] } = {}) {
    const { choose, from } = raceBonus(race);
    if (!choose) return [];
    if (from !== 'non_career') return from.map(name => ({ name, blocked: null }));
    const career = new Set(careerSkills);
    const spec = new Set(specSkills);
    return ALL_SKILLS.map(s => ({ name: s.name, blocked: career.has(s.name) ? 'career' : spec.has(s.name) ? 'spec' : null }));
}

// Цена первого ранга — как в buySkillRank (character-generator.js)
export const firstRankCost = (name, selectedCareerSkills) => (selectedCareerSkills.includes(name) ? 5 : 10);

// Навык можно снять с выбора, пока поверх бесплатного ранга ничего не куплено
export const canDropRaceSkill = (s, name) => !((s.skillRanks[name] || 0) > 1);

// Навыки становятся расовыми: без рангов — ранг 1; с купленными рангами — ранг остаётся, а цена
// первого ранга возвращается (не больше потраченного). История «Отменить» очищается: отмена
// сняла бы бесплатный ранг. Возвращает новые значения полей состояния, исходное не меняется
export function grantRaceSkills(s, names) {
    const granted = known(names);
    const skillRanks = { ...s.skillRanks };
    let spent = s.xpData.spent;
    const entries = [];
    for (const name of granted) {
        if (!(skillRanks[name] > 0)) { skillRanks[name] = 1; continue; }
        const refund = Math.min(firstRankCost(name, s.selectedCareerSkills), Math.max(0, spent));
        if (refund > 0) { spent -= refund; entries.unshift(`+${refund} Расовый ранг: ${name}`); }
    }
    return {
        skillRanks,
        xpData: { earned: s.xpData.earned, spent },
        // В журнале остаются последние 5 записей — как в xp.js
        xpLog: [...entries, ...s.xpLog].slice(0, 5),
        xpHistory: granted.length ? [] : s.xpHistory,
    };
}

// Сохранение до версии 6 (результат checkSave save-check.js): фиксированные расовые навыки race
// получают ранг по правилу grantRaceSkills в самом сохранении — до записи в базу и до листа.
// Дальше результат — как сохранение версии 6: ранги второй раз не начисляются. Остальное — как есть
export function withRaceRanks(result, race) {
    if (!(result.fromVersion < 6)) return result;
    return { ...result, save: { ...result.save, ...grantRaceSkills(result.save, raceBonus(race).fixed) }, fromVersion: 6 };
}

// Новый выбор игрока. Снятый навык теряет бесплатный ранг (если поверх куплены ранги — отказ);
// добавленный получает ранг по правилу grantRaceSkills. Навык, выбранный раньше, остаётся
// допустимым, даже если с тех пор стал карьерным
export function applyRaceChoice(s, race, next, context) {
    const { fixed, choose } = raceBonus(race);
    const picked = [...new Set(next)];
    if (!choose || picked.length !== choose || next.length !== choose) return { ok: false, reason: 'count' };
    const prev = chosenRaceSkills(race, s.raceSkills);
    const options = new Map(raceChoiceOptions(race, context).map(o => [o.name, o]));
    const added = picked.filter(n => !prev.includes(n));
    const removed = prev.filter(n => !picked.includes(n));
    if (picked.some(n => !options.has(n)) || added.some(n => options.get(n).blocked)) return { ok: false, reason: 'not_allowed' };
    const locked = removed.filter(n => !canDropRaceSkill(s, n));
    if (locked.length) return { ok: false, reason: 'locked', locked };
    const skillRanks = { ...s.skillRanks };
    for (const name of removed) if (!fixed.includes(name)) delete skillRanks[name];
    return { ok: true, patch: { ...grantRaceSkills({ ...s, skillRanks }, added), xpHistory: [], raceSkills: picked } };
}
