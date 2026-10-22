import { wornArmor } from './inventory.js';

// Производные значения листа (4.2, спека 2026-10-14-gm-dashboard.md): итоговые характеристики,
// пороги ран и усталости, поглощение и защита. Одна формула для листа (getDerivedStats и
// modifyCurrent в character-generator.js) и карточек группы на дашборде мастера (party-model.js) —
// числа не расходятся. Модуль чистый: его импортируют тесты в Node.
// save — сохранение или его часть: raceVal, statMods, thresholdMods, inventory.items; races —
// state.db.races; catalog — CATALOG (reference-data.js). Броня — надетая броня инвентаря
// (inventory.js; armor — её вид или null): поглощение = Физ. сила + её поглощение, защита — её
// защита. null — расы нет в справочнике.
export function sheetStats(save, races, catalog) {
    const race = races.find(r => r.id === save.raceVal);
    if (!race) return null;
    const finalStats = {};
    Object.keys(race.stats).forEach(key => { finalStats[key] = race.stats[key] + (save.statMods[key] || 0); });
    const armor = wornArmor(save.inventory.items, catalog);
    return {
        finalStats,
        maxWounds: race.baseWounds + finalStats.brawn + save.thresholdMods.wounds,
        maxStrain: race.baseStrain + finalStats.willpower + save.thresholdMods.strain,
        soak: finalStats.brawn + (armor ? armor.soak : 0),
        defense: armor ? armor.defense : 0,
        armor,
    };
}
