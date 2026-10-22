// Смена карьеры и специализации (подпроект 3b, решение пользователя 2026-10-01). Таланты куплены
// в дереве конкретной специализации: когда основную или вторую специализацию заменяют или вторую
// убирают, купленные узлы прежнего дерева снимаются, а XP за них возвращается на счёт. Ранги
// навыков, характеристики, узлы Силы, раны, усталость и поправки порогов не меняются.
// Модуль чистый: не трогает document, window и localStorage — его импортируют тесты в Node.

// Что снимется: купленные узлы дерева прежней специализации (nodes — TALENTS_DB[specId]; дерева
// может не быть) и XP за них. count === 0 — терять нечего, подтверждение не нужно.
export function specRefund(s, nodes) {
    const bought = new Set(s.purchasedTalents);
    const lost = (nodes || []).filter(n => bought.has(n.id));
    return { ids: lost.map(n => n.id), count: lost.length, xp: lost.reduce((sum, n) => sum + (n.cost || 0), 0) };
}

// Новые значения полей состояния после смены; исходный объект не меняется. История «Отменить»
// очищается всегда: снимок, сделанный до смены, вернул бы купленные узлы уже не выбранного дерева
// (и траты за них) — даже если в момент смены терять было нечего.
export function resetForSpecChange(s, nodes) {
    const { ids, xp } = specRefund(s, nodes);
    const gone = new Set(ids);
    // Запись в журнал — как у смены расы (race-change.js); в журнале остаются последние 5 записей
    const xpLog = xp > 0
        ? [`+${xp} Смена специализации`, ...s.xpLog].slice(0, 5)
        : [...s.xpLog];
    return {
        purchasedTalents: s.purchasedTalents.filter(id => !gone.has(id)),
        usedTalents: s.usedTalents.filter(id => !gone.has(id)),
        // Испорченное сохранение (потрачено меньше, чем стоят узлы) не уводит траты в минус
        xpData: { earned: s.xpData.earned, spent: Math.max(0, s.xpData.spent - xp) },
        xpHistory: [],
        xpLog,
    };
}

// Три навыка со скидкой (selectedCareerSkills) выбираются из карьерных: при смене карьеры
// остаются только те, что есть и у новой, — иначе скидку получал бы некарьерный навык, а место
// из трёх было бы занято навыком без галочки на листе
export function keptCareerSkills(selected, careerSkills) {
    const allowed = new Set(careerSkills || []);
    return selected.filter(name => allowed.has(name));
}

// Текст подтверждения. kind: 'spec' — замена основной, 'career' — смена карьеры (вместе с
// основной), 'spec2' — замена второй, 'spec2-remove' — удаление второй
export function specChangeMessage({ kind, careerName, specName, oldSpecName, count, xp }) {
    const head = {
        'spec': `Сменить специализацию на «${specName}»?`,
        'career': `Сменить карьеру на «${careerName}» (специализация «${specName}»)?`,
        'spec2': `Сменить вторую специализацию на «${specName}»?`,
        'spec2-remove': `Убрать вторую специализацию «${oldSpecName}»?`,
    }[kind];
    return `${head}\n\nТаланты специализации «${oldSpecName}» будут сняты (${count} шт.), ${xp} XP вернутся на счёт.\n\nНавыки, характеристики и всё остальное останутся.`;
}
