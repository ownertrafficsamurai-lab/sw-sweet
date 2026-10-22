// Что показывает карточка характеристики (stat-panel.js). Чистый модуль: без DOM и сети,
// тестируется в Node. Правила — те же, что в tryBuyStat / tryRefundStat
// (character-generator.js): максимум 6, следующий уровень стоит «новое значение × 10» XP,
// вернуть можно только купленное за XP.
const MAX_STAT = 6;
const XP_PER_LEVEL = 10;

// Порядок книги правил. Ключи race.stats из Supabase приходят в порядке JSONB, поэтому
// лента и вкладки карточки идут по этому списку, а не по Object.keys(race.stats).
export const STAT_ORDER = ['brawn', 'agility', 'intellect', 'cunning', 'willpower', 'presence'];

export function maxEncumbrance(brawn) {
    return brawn + 5;
}

export function statInfo(key, { raceStats, statMods, availXP, derived, skills }) {
    const raceValue = raceStats[key];
    const bought = statMods[key] || 0;
    const value = raceValue + bought;

    let nextValue = value + 1;
    let nextCost = nextValue * XP_PER_LEVEL;
    let buyBlock = null;
    let shortBy = 0;
    if (nextValue > MAX_STAT) {
        buyBlock = 'max';
        nextValue = null;
        nextCost = null;
    } else if (availXP < nextCost) {
        buyBlock = 'xp';
        shortBy = nextCost - availXP;
    }

    // Только то, что считают формулы листа (getDerivedStats, updateEncumbrance)
    const affects = [];
    if (key === 'brawn') {
        affects.push(
            { label: 'Порог ран', value: derived.maxWounds },
            { label: 'Поглощение', value: derived.soak },
            { label: 'Макс. нагрузка', value: maxEncumbrance(value) },
        );
    }
    if (key === 'willpower') affects.push({ label: 'Порог усталости', value: derived.maxStrain });

    return {
        value, raceValue, isModified: bought > 0,
        nextValue, nextCost, buyBlock, shortBy,
        canRefund: bought > 0,
        affects,
        skills: skills.filter(s => s.char === key).map(s => s.name),
    };
}
