// Связи и доступность узлов в деревьях талантов и Силы (решение 10 спеки 3a).
// Связь есть, только если её объявили оба узла: "down" у верхнего и "up" у нижнего
// (их столбцы пересекаются — у широкого узла width > 1), либо "right" у левого и
// "left" у правого (правый начинается сразу за левым). Прочие значения в links
// игнорируются. Связь двусторонняя.
// Узел можно купить, если он в первом ряду, или у него нет взаимных связей ни с рядом
// выше, ни по своему ряду, или он взаимно связан с уже купленным узлом — в любую сторону.
// Узел со связью по ряду открывается от соседа («Force Rating» seer_5_4 — от «Natural
// Mystic» seer_5_3; поправка пользователя к решению 10 спеки 3a, 2026-09-25).
const width = n => n.width || 1;
const overlaps = (a, b) => a.col <= b.col + width(b) - 1 && b.col <= a.col + width(a) - 1;
const declares = (n, dir) => Array.isArray(n.links) && n.links.includes(dir);

export function buildTalentGraph(nodes) {
    const visible = nodes.filter(n => !n.invisible);
    const byId = new Map(visible.map(n => [n.id, n]));
    const neighbors = new Map(visible.map(n => [n.id, new Set()]));
    const upper = new Map(visible.map(n => [n.id, []]));
    const lower = new Map(visible.map(n => [n.id, []]));
    const right = new Map();
    const left = new Map();
    const connect = (a, b) => { neighbors.get(a.id).add(b.id); neighbors.get(b.id).add(a.id); };

    for (const a of visible) {
        for (const b of visible) {
            if (b.row === a.row + 1 && overlaps(a, b) && declares(a, 'down') && declares(b, 'up')) {
                connect(a, b);
                lower.get(a.id).push(b.id);
                upper.get(b.id).push(a.id);
            }
            if (b.row === a.row && b.col === a.col + width(a) && declares(a, 'right') && declares(b, 'left')) {
                connect(a, b);
                right.set(a.id, b.id);
                left.set(b.id, a.id);
            }
        }
    }
    // Корни: первый ряд и узлы без взаимных связей с рядом выше и по своему ряду
    const isRoot = n => n.row === 1 || (upper.get(n.id).length === 0 && !left.has(n.id) && !right.has(n.id));
    const roots = new Set(visible.filter(isRoot).map(n => n.id));
    return { byId, neighbors, upper, lower, right, left, roots };
}

export function isAvailable(graph, id, purchased) {
    if (!graph.byId.has(id)) return false;
    if (purchased.has(id) || graph.roots.has(id)) return true;
    for (const n of graph.neighbors.get(id)) if (purchased.has(n)) return true;
    return false;
}

// Достижимые узлы этого дерева из купленных корней через купленные узлы данного набора.
const reachable = (graph, ids) => {
    const present = new Set([...ids].filter(p => graph.byId.has(p)));
    const queue = [...present].filter(p => graph.roots.has(p));
    const reached = new Set(queue);
    for (let i = 0; i < queue.length; i++) {
        for (const n of graph.neighbors.get(queue[i])) {
            if (present.has(n) && !reached.has(n)) { reached.add(n); queue.push(n); }
        }
    }
    return reached;
};

// Возврат запрещён, только если он отключает узел, который был подключён до возврата.
// В сохранённых персонажах MVP встречаются купленные узлы дерева, у которых при переносе
// переименовали только базовый узел (move_basic → move_1_1), а остальные (move_2_1, move_2_2…)
// остались в дереве, но потеряли связь с купленным корнем ещё до этого возврата — такие
// "осиротевшие" узлы не должны блокировать возврат вообще всех талантов дерева. Купленные
// узлы других деревьев не учитываются (их нет в graph.byId).
export function canRefund(graph, id, purchased) {
    const before = reachable(graph, purchased);
    const after = reachable(graph, [...purchased].filter(p => p !== id));
    for (const n of before) {
        if (n !== id && !after.has(n)) return false;
    }
    return true;
}

// Минимальная сумма цен некупленных узлов на пути от любого корня до узла включительно
// (купленные — 0). Дейкстра по весам узлов; деревья маленькие, поиск минимума — перебором.
export function unlockCosts(graph, purchased) {
    const weight = id => (purchased.has(id) ? 0 : graph.byId.get(id).cost);
    const dist = new Map();
    for (const id of graph.roots) dist.set(id, weight(id));
    const done = new Set();
    for (;;) {
        let best = null;
        for (const [id, d] of dist) if (!done.has(id) && (best === null || d < dist.get(best))) best = id;
        if (best === null) break;
        done.add(best);
        for (const n of graph.neighbors.get(best)) {
            const candidate = dist.get(best) + weight(n);
            if (!dist.has(n) || candidate < dist.get(n)) dist.set(n, candidate);
        }
    }
    return dist;
}
