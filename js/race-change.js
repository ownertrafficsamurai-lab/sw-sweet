// Смена расы у персонажа с прокачкой (решение пользователя 2026-09-25). Покупки за XP привязаны
// к расе: характеристики — прибавка к её базе, их цена и стартовый XP зависят от расы. Поэтому
// смена расы снимает всё купленное за XP (характеристики, навыки, таланты и улучшения Силы) и
// возвращает потраченный XP на счёт; XP от мастера, мораль, имя, карьера, заметки и снаряжение
// остаются. Раны, усталость и поправки порогов обнуляются, как в MVP.
// Бесплатные расовые ранги и выбор расовых навыков тоже снимаются (race-skills.js).
// Модуль чистый: не трогает document, window и localStorage — его импортируют тесты в Node.

const anySet = values => values.some(Boolean);

// Сбросит ли смена расы что-нибудь у персонажа — тогда нужно подтверждение. racial — расовые
// навыки персонажа (race-skills.js): их бесплатный первый ранг прокачкой не считается
export function raceChangeResetsProgress(s, racial = []) {
    const boughtRanks = Object.entries(s.skillRanks).some(([name, rank]) => rank > (racial.includes(name) ? 1 : 0));
    return anySet(Object.values(s.statMods)) || boughtRanks
        || s.purchasedTalents.length > 0 || s.xpData.spent !== 0
        || anySet(Object.values(s.thresholdMods)) || anySet(Object.values(s.currentStatus));
}

// Новые значения полей состояния после смены расы; исходный объект не меняется
export function resetForRaceChange(s) {
    const refund = s.xpData.spent;
    // Запись в журнал — чистым текстом, как в xp-history.js; в журнале остаются последние 5 записей
    const xpLog = refund > 0
        ? [`+${refund} Смена расы`, ...s.xpLog].slice(0, 5)
        : [...s.xpLog];
    return {
        statMods: { brawn: 0, agility: 0, intellect: 0, cunning: 0, willpower: 0, presence: 0 },
        skillRanks: {},
        // Выбор расовых навыков относится к прежней расе; ранги новой начисляет race-skills.js
        raceSkills: [],
        purchasedTalents: [],
        usedTalents: [],
        thresholdMods: { wounds: 0, strain: 0 },
        currentStatus: { wounds: 0, strain: 0 },
        xpData: { earned: s.xpData.earned, spent: 0 },
        // Отмена последней операции с XP после сброса вернула бы траты без покупок
        xpHistory: [],
        xpLog,
    };
}
