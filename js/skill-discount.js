import { isKnowledgeSkill, skillRankCost } from './skills.js';
import { discountRules, isRaceCheap, raceSkillNames, withRaceRanks } from './race-skills.js';

// Флажки скидки (спека 2026-10-26-skill-discount-flags.md). Домашняя схема стола: отмеченный флажком
// навык стоит 5×ранг, остальные — 5×ранг+5. Флажки — из двух запасов: карьерный (навыки «К» карьеры,
// обычно 3) и специализации (бонусные навыки «С» основной специализации, обычно 2); навык «К» + «С»
// засчитывается туда, где есть место. Запасы и скидку на Знания задаёт раса (discountRules). Отметки —
// один список state.selectedCareerSkills в порядке отметки. Модуль чистый: не трогает document,
// window и localStorage — его импортируют тесты в Node.

// Вторая специализация флажков не даёт — третьего списка нет
export function discountContext(race, careerSkills = [], specSkills = []) {
    return { race, rules: discountRules(race), career: new Set(careerSkills), spec: new Set(specSkills) };
}

// 'career' | 'spec' | 'both' | null; null — у навыка со скидкой от расы и у навыка вне карьеры и
// основной специализации
export function flagKind(name, ctx) {
    if (isRaceCheap(name, ctx.race)) return null;
    const career = ctx.career.has(name), spec = ctx.spec.has(name);
    if (career && spec) return 'both';
    return career ? 'career' : spec ? 'spec' : null;
}

const countKinds = (list, ctx) => {
    const kinds = list.map(n => flagKind(n, ctx));
    return { career: kinds.filter(k => k === 'career').length, spec: kinds.filter(k => k === 'spec').length };
};

// Набор раскладывается по запасам: только «К» — не больше карьерного, только «С» — не больше запаса
// специализации, всего — не больше суммы
export function flagsValid(selected, ctx) {
    if (selected.some(n => flagKind(n, ctx) === null)) return false;
    const { career, spec } = ctx.rules;
    const k = countKinds(selected, ctx);
    return k.career <= career && k.spec <= spec && selected.length <= career + spec;
}

const allowedFlags = (selected, ctx) => selected.filter(n => flagKind(n, ctx) !== null);

export function canAddFlag(selected, name, ctx) {
    if (selected.includes(name) || flagKind(name, ctx) === null) return false;
    return flagsValid([...allowedFlags(selected, ctx), name], ctx);
}

export function flagSummary(selected, ctx) {
    const { career, spec, cheapKnowledge } = ctx.rules;
    return { used: allowedFlags(selected, ctx).length, total: career + spec, career, spec, cheapKnowledge };
}

// Отмеченный, но больше не допустимый навык (после смены карьеры, специализации, расы) скидки не даёт
export function isDiscounted(name, selected, ctx) {
    return isRaceCheap(name, ctx.race) || (selected.includes(name) && flagKind(name, ctx) !== null);
}

export function rankCost(name, rank, selected, ctx) {
    return skillRankCost(rank, isDiscounted(name, selected, ctx));
}

// Сколько отметок самое меньшее надо снять, чтобы набор стал допустимым: лишние «К» и «С» сверх
// своих запасов, затем — то, что не помещается в сумму запасов
function excess(list, ctx) {
    const { career, spec } = ctx.rules;
    const k = countKinds(list, ctx);
    const both = list.length - k.career - k.spec;
    const over = Math.max(0, k.career - career) + Math.max(0, k.spec - spec);
    return over + Math.max(0, Math.min(k.career, career) + Math.min(k.spec, spec) + both - career - spec);
}

// Отметки после смены карьеры, специализации или расы: недопустимые и повторы убираются; если вместе
// их больше запаса — снимаются сначала отмеченные последними без купленных рангов, затем отмеченные
// последними с рангами. Допустимый набор возвращается как был
export function trimFlags(selected, ctx, skillRanks = {}) {
    let kept = allowedFlags([...new Set(selected)], ctx);
    while (excess(kept, ctx) > 0) {
        const bought = n => skillRanks[n] > 0;
        const order = [...kept.filter(n => !bought(n)).reverse(), ...kept.filter(bought).reverse()];
        const victim = order.find(n => excess(kept.filter(x => x !== n), ctx) < excess(kept, ctx));
        kept = kept.filter(x => x !== victim);
    }
    return kept;
}

// Версия сохранения, с которой Знания цереанина дешевле: старому сохранению разница возвращается один раз
const CHEAP_KNOWLEDGE_VERSION = 8;
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Сохранение (результат checkSave) перед листом и записью в базу: бесплатные ранги расы старым
// сохранениям (withRaceRanks); старому цереанину — по 5 XP за каждый купленный без флажка ранг Знаний
// (бесплатный первый ранг расы не считается, не больше потраченного), флажки на Знаниях снимаются;
// при каждом открытии — набор флажков обрезается до допустимого. Ничего не изменилось — тот же объект
export function upgradeSave(result, race, { careerSkills = [], specSkills = [] } = {}) {
    const ready = withRaceRanks(result, race);
    let save = ready.save;
    let changed = false;
    if (ready.fromVersion < CHEAP_KNOWLEDGE_VERSION && discountRules(race).cheapKnowledge) {
        const free = new Set(raceSkillNames(race, save.raceSkills));
        let refund = 0;
        for (const [name, rank] of Object.entries(save.skillRanks)) {
            if (!isKnowledgeSkill(name) || !(rank > 0) || save.selectedCareerSkills.includes(name)) continue;
            refund += 5 * (rank - (free.has(name) ? 1 : 0));
        }
        refund = Math.min(refund, Math.max(0, save.xpData.spent));
        save = { ...save, selectedCareerSkills: save.selectedCareerSkills.filter(n => !isKnowledgeSkill(n)) };
        if (refund > 0) {
            save.xpData = { earned: save.xpData.earned, spent: save.xpData.spent - refund };
            // В журнале остаются последние 5 записей — как в xp.js
            save.xpLog = [`+${refund} Скидка расы: Знания`, ...save.xpLog].slice(0, 5);
            save.xpHistory = [];
        }
        changed = true;
    }
    const flags = trimFlags(save.selectedCareerSkills, discountContext(race, careerSkills, specSkills), save.skillRanks);
    if (!sameList(flags, save.selectedCareerSkills)) {
        save = { ...save, selectedCareerSkills: flags };
        changed = true;
    }
    if (!changed && ready.fromVersion >= CHEAP_KNOWLEDGE_VERSION) return ready;
    return { ...ready, save, fromVersion: Math.max(CHEAP_KNOWLEDGE_VERSION, ready.fromVersion) };
}
