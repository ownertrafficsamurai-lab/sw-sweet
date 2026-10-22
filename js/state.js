export const state = {
    // Справочники (расы, карьеры со специализациями) — заполняет loadReferenceData() из Supabase
    db: { races: [], careers: [] },
    statMods: { brawn: 0, agility: 0, intellect: 0, cunning: 0, willpower: 0, presence: 0 },
    thresholdMods: { wounds: 0, strain: 0 },
    currentStatus: { wounds: 0, strain: 0 },
    xpData: { earned: 0, spent: 0 },
    xpHistory: [],
    xpLog: [],
    skillRanks: {},
    morality: 50,
    currentTreeMode: 'spec',

    isSaveReady: false,
    charAvatar: "",
    forceRating: 1,
    criticalInjuries: [],
    purchasedTalents: [],
    selectedCareerSkills: [],
    // Расовые навыки, выбранные игроком (человек, гран, тви'лек) — правила в race-skills.js
    raceSkills: [],
    playerNotes: "",
    usedTalents: [],
    lightsaberChar: "brawn",

    obligations: [],
    // Инвентарь (подпроект Б1): предметы из каталога или свои — форма в inventory.js
    inventory: { credits: 0, items: [] },
};
