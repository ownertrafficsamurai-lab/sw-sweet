// Вкладка «Способности» (спека 2026-09-30-abilities-tab.md, раздел 1): из купленных узлов всех
// деревьев талантов и Силы — плитки «Активные» / «Пассивные» и карточки Силы с улучшениями.
// Чистые функции: без DOM и хранилища — тестируются в Node (tests/abilities.test.js).
const byName = (a, b) => a.localeCompare(b, 'ru');
const uniqueRows = nodes => [...new Set(nodes.map(n => n.row))];

// purchased — id купленных узлов; talentTrees / forceTrees — TALENTS_DB / FORCE_DB (словари
// массивов узлов), forceList — FORCE_LIST. Id, которых нет ни в одном дереве, и узлы invisible
// пропускаются.
export function collectAbilities({ purchased, talentTrees, forceTrees, forceList }) {
    const bought = new Set(purchased);
    const isBought = n => !n.invisible && bought.has(n.id);
    return { ...collectTalents(talentTrees, isBought), force: collectForce(forceTrees, forceList, bought, isBought) };
}

// Плитка — имя таланта: все купленные узлы с этим именем из любых деревьев. Узлы — по ряду,
// при равном ряде — в порядке деревьев и узлов (сортировка устойчива); первый узел даёт описание
// и «главный» id отметки. В «Активные» — если хотя бы один узел не пассивный.
function collectTalents(talentTrees, isBought) {
    const byTalent = new Map();
    for (const tree of Object.values(talentTrees)) {
        for (const n of tree.filter(isBought)) {
            if (!byTalent.has(n.name)) byTalent.set(n.name, []);
            byTalent.get(n.name).push(n);
        }
    }
    const active = [], passive = [];
    for (const [name, found] of byTalent) {
        const nodes = [...found].sort((a, b) => a.row - b.row);
        const tile = { name, desc: nodes[0].desc, ids: nodes.map(n => n.id), rank: nodes.length, tiers: uniqueRows(nodes) };
        (nodes.some(n => !n.passive) ? active : passive).push(tile);
    }
    const order = (a, b) => a.tiers[0] - b.tiers[0] || byName(a.name, b.name);
    return { active: active.sort(order), passive: passive.sort(order) };
}

// Карточка — на силу, у которой куплен хотя бы один узел. База — узел ряда 1; улучшения — купленные
// узлы рядов 2–5 этой силы, одна строка на пару (название, текст).
function collectForce(forceTrees, forceList, bought, isBought) {
    const cards = [];
    for (const [id, tree] of Object.entries(forceTrees)) {
        const nodes = tree.filter(isBought);
        if (!nodes.length) continue;
        const base = tree.find(n => n.row === 1);
        const groups = new Map();
        for (const n of nodes.filter(n => n.row > 1).sort((a, b) => a.row - b.row || a.col - b.col)) {
            const key = `${n.name}\n${n.desc}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(n);
        }
        // Строки — по наименьшему тиру, названию, затем по месту первого узла в дереве
        const upgrades = [...groups.values()]
            .sort((a, b) => a[0].row - b[0].row || byName(a[0].name, b[0].name) || a[0].col - b[0].col)
            .map(g => ({
                name: g[0].name, desc: g[0].desc, passive: g.every(n => n.passive),
                count: g.length, tiers: uniqueRows(g), ids: g.map(n => n.id),
            }));
        cards.push({
            id,
            name: forceList.find(f => f.id === id)?.name ?? base?.name ?? id,
            baseCost: base?.cost ?? 0,
            baseBought: !!base && bought.has(base.id),
            baseDesc: base?.desc ?? '',
            upgrades,
        });
    }
    return cards.sort((a, b) => byName(a.name, b.name));
}

// Отметка «использован» (раздел 3.3): если отмечен любой id плитки — снять все её id, иначе
// отметить первый. Возвращает новый массив.
export function toggleUsed(used, ids) {
    return ids.some(id => used.includes(id)) ? used.filter(id => !ids.includes(id)) : [...used, ids[0]];
}
