import { CATALOG } from './reference-data.js';
import { openSheet, closeSheet } from './bottom-sheet.js';
import { DESKTOP_QUERY } from './hud-math.js';
import { RANGE_LABELS, critLabel, catalogGroups } from './inventory.js';
import { addCatalogItem, addCustomItem } from './inventory-equipment.js';
import { iconKey, iconElement } from './item-icons.js';

// Окно «+ Добавить» (подпроект Б1, макет catalog-picker.html, вариант A): каталог одного типа —
// поиск, «✎ Своё …», список по группам с кнопкой «+». На телефоне — шторка снизу, на компьютере —
// окно по центру (механизм панелей bottom-sheet.js: ×, затемнение, свайп вниз, Esc). После «+» окно
// не закрывается, кнопка на время показывает ✓. Названия каталога — только текстом.
const byId = id => document.getElementById(id);
const TITLES = { weapon: 'Добавить оружие', armor: 'Добавить броню', gear: 'Добавить снаряжение' };
const OWN = { weapon: '✎ Своё оружие', armor: '✎ Своя броня', gear: '✎ Свой предмет' };
const DONE_MS = 1200;
let pickerType = 'weapon';

export function openCatalogPicker(type) {
    pickerType = type;
    byId('catalog-picker-title').textContent = TITLES[type];
    byId('catalog-picker-own').textContent = OWN[type];
    byId('catalog-picker-search').value = '';
    byId('catalog-picker-status').textContent = '';
    renderPickerList();
    openSheet('catalog-picker');
    byId('catalog-picker-list').scrollTop = 0;
    // На компьютере — сразу в поиск; на телефоне фокус на «×», чтобы клавиатура не закрыла список
    if (window.matchMedia(DESKTOP_QUERY).matches) byId('catalog-picker-search').focus();
}

export function renderPickerList() {
    const groups = catalogGroups(pickerType, CATALOG, byId('catalog-picker-search').value);
    const list = byId('catalog-picker-list');
    if (!groups.length) {
        const empty = document.createElement('p');
        empty.className = 'picker-empty';
        empty.textContent = 'Ничего не найдено.';
        list.replaceChildren(empty);
        return;
    }
    list.replaceChildren(...groups.flatMap(g => {
        const rows = document.createElement('ul');
        rows.className = 'picker-rows';
        rows.append(...g.rows.map(pickerRow));
        if (!g.label) return [rows];
        const title = document.createElement('p');
        title.className = 'picker-group';
        title.textContent = g.label;
        return [title, rows];
    }));
}

// «✎ Своё …»: окно закрывается, в разделе появляется пустой свой предмет с раскрытой строкой
export function addOwnFromPicker() {
    closeSheet();
    addCustomItem(pickerType);
}

function span(className, text) {
    const s = document.createElement('span');
    s.className = className;
    s.textContent = text;
    return s;
}

function pickerRow(row) {
    const li = document.createElement('li');
    li.className = 'picker-row';
    li.dataset.catalog = row.id;
    const main = document.createElement('div');
    main.className = 'picker-main';
    const name = span('picker-name', row.name);
    if (row.restricted) name.append(' ', span('inv-r', 'R'));
    main.append(name, pickerStats(row));
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'picker-add';
    add.textContent = '+';
    add.setAttribute('aria-label', `Добавить «${row.name}»`);
    let timer = null;
    add.addEventListener('click', () => {
        const result = addCatalogItem(pickerType, row.id);
        if (!result) return;
        byId('catalog-picker-status').textContent = result.merged ? `Добавлено ещё: ${row.name} — ${result.qty}` : `Добавлено: ${row.name}`;
        add.textContent = '✓';
        add.classList.add('picker-done');
        clearTimeout(timer);
        timer = setTimeout(() => { add.textContent = '+'; add.classList.remove('picker-done'); }, DONE_MS);
    });
    // Рисунок — без плашки (плашка — признак предмета, который уже в инвентаре)
    const icon = span('picker-ico', '');
    icon.append(iconElement(iconKey({ type: pickerType, icon: row.id, skill: row.skill })));
    li.append(icon, main, add);
    return li;
}

// Ключевые статы: оружие — урон (у рукопашного «+N»), крит, дистанция; броня — защита и
// поглощение; снаряжение — груз
function pickerStats(row) {
    const stats = document.createElement('span');
    stats.className = 'picker-stats';
    const pair = (label, value, tag) => { const s = span('', `${label} `); const v = document.createElement(tag); v.textContent = value; s.append(v); return s; };
    if (pickerType === 'weapon') {
        stats.append(pair('Ур', row.damage_adds_brawn ? `+${row.damage}` : String(row.damage), 'b'), pair('Кр', critLabel(row.crit), 'i'), span('', RANGE_LABELS[row.range] || ''));
    } else if (pickerType === 'armor') {
        stats.append(pair('Защ', String(row.defense), 'b'), pair('Погл', String(row.soak), 'b'));
    } else {
        stats.append(span('', `Груз ${row.encumbrance ?? '—'}`));
    }
    return stats;
}
