import { buildTalentGraph } from './talent-graph.js';

// Обзорное дерево талантов для окна выбора специализации (спека 2026-10-01-talent-tree-preview.md):
// только названия, цены рядов, связи и признак действия. Ничего не знает о персонаже — купленные
// таланты и доступность показывает вкладка «Таланты» (talent-tree.js).
const span = n => n.width || 1;

// Модель дерева: { rows, cells } или null, если дерева нет. rows[i] — цена ряда i + 1 строкой
// («5»; «5/10», если в ряду цены разные; '' — в ряду нет узлов). cells — видимые узлы:
// right — взаимная связь с правым соседом; down — положения линий к связанным нижним узлам,
// в процентах ширины клетки (у обычной клетки [50]; у широкой — по центру общих столбцов,
// та же формула, что в talent-tree.js)
export function previewModel(nodes) {
    if (!Array.isArray(nodes)) return null;
    const graph = buildTalentGraph(nodes);
    const visible = [...graph.byId.values()];
    if (!visible.length) return null;
    const cells = visible.map(n => ({
        id: n.id, name: n.name, row: n.row, col: n.col, width: span(n), action: !n.passive,
        right: graph.right.has(n.id),
        down: graph.lower.get(n.id).map(id => {
            const low = graph.byId.get(id);
            const from = Math.max(n.col, low.col);
            const to = Math.min(n.col + span(n) - 1, low.col + span(low) - 1);
            return (((from + to) / 2 - n.col + 0.5) / span(n)) * 100;
        }),
    }));
    const last = Math.max(...visible.map(n => n.row));
    const rows = Array.from({ length: last }, (_, i) =>
        [...new Set(visible.filter(n => n.row === i + 1).map(n => n.cost))].sort((a, b) => a - b).join('/'));
    return { rows, cells };
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// Элемент дерева или null, если дерева нет. Для экранной читалки дерево — одна картинка с
// подписью; клетки и линии скрыты (названия талантов читаются на вкладке «Таланты»).
// Первый столбец сетки — цены рядов, поэтому столбец таланта сдвинут на 1
export function treePreviewElement(nodes, specName) {
    const model = previewModel(nodes);
    if (!model) return null;
    const box = el('div', 'choice-tree');
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', `Дерево талантов: ${specName}, талантов: ${model.cells.length}`);

    const grid = el('div', 'choice-tree-grid');
    grid.setAttribute('aria-hidden', 'true');
    model.rows.forEach((cost, i) => {
        const price = el('span', 'choice-tree-cost', cost);
        price.style.gridRow = String(i + 1);
        grid.append(price);
    });
    for (const cell of model.cells) {
        const node = el('div', `choice-tree-cell${cell.action ? ' choice-tree-action' : ''}`);
        node.style.gridRow = String(cell.row);
        node.style.gridColumn = `${cell.col + 1} / span ${cell.width}`;
        node.append(el('span', 'choice-tree-name', cell.name));
        if (cell.right) node.append(el('i', 'choice-tree-link choice-tree-link-right'));
        for (const percent of cell.down) {
            const line = el('i', 'choice-tree-link choice-tree-link-down');
            line.style.left = `${percent}%`;
            node.append(line);
        }
        grid.append(node);
    }

    const legend = el('p', 'choice-tree-legend');
    legend.setAttribute('aria-hidden', 'true');
    legend.append(el('span', 'choice-tree-key choice-tree-action', 'действие'), el('span', 'choice-tree-key', 'пассивный'), el('span', '', 'слева — цена, XP'));
    box.append(grid, legend);
    return box;
}
