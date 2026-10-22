// История для кнопки «Отменить» в блоке XP. Снимок делается до операции с XP и хранит не только
// числа XP и журнал, но и покупки (характеристики, ранги навыков, таланты и узлы Силы) — иначе
// отмена покупки возвращала XP, а купленное оставалось (баг, найден пользователем 2026-09-25).
// Старые записи из автосейвов покупок не содержат — у них восстанавливаются только XP и журнал.
// Модуль чистый: не трогает document, window и localStorage — его импортируют тесты в Node.

export function xpSnapshot(s) {
    return {
        earned: s.xpData.earned, spent: s.xpData.spent, log: [...s.xpLog],
        statMods: { ...s.statMods }, skillRanks: { ...s.skillRanks },
        purchasedTalents: [...s.purchasedTalents], usedTalents: [...s.usedTalents],
    };
}

// Значения полей состояния, которые возвращает отмена; снимок не меняется
export function restoreXPSnapshot(snap) {
    const restored = { xpData: { earned: snap.earned, spent: snap.spent }, xpLog: [...snap.log] };
    if (!snap.statMods) return restored;
    return {
        ...restored,
        statMods: { ...snap.statMods }, skillRanks: { ...snap.skillRanks },
        purchasedTalents: [...snap.purchasedTalents], usedTalents: [...snap.usedTalents],
    };
}

// Текст записи журнала XP — чистый, без разметки (подпроект 4а): журнал уедет в общую базу, а
// цвет строки панель XP (xp-panel.js) берёт по знаку. desc — что куплено («Навык Драка 2»)
export function xpLogEntry(action, val, desc = '') {
    switch (action) {
        case 'add': return `+${val} Награда`;
        case 'spend': return `-${val} Трата`;
        case 'buy_talent': return `-${val} Талант`;
        case 'buy_skill': return `-${val} ${desc || 'Навык'}`;
        case 'buy_stat': return `-${val} ${desc || 'Стат'}`;
        case 'refund_talent':
        case 'refund_skill':
        case 'refund_stat': return `+${val} Отмена`;
        default: return '';
    }
}
