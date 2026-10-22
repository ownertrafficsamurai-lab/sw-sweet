import { state } from './state.js';
import { openSheet, closeSheet } from './bottom-sheet.js';
import { DESKTOP_QUERY } from './hud-math.js';
import { STAT_ORDER } from './stat-info.js';
import { raceView, careerView, specView, spec2View, neighborId } from './choice-model.js';
import { STAT_CONFIG, chooseRace, chooseSpec, chooseSpec2 } from './character-generator.js';
import { TALENTS_DB } from './reference-data.js';
import { treePreviewElement } from './tree-preview.js';

// Окно выбора расы, карьеры, специализации и второй специализации (подпроект 3b). Одно окно на
// механизме панелей bottom-sheet.js (×, затемнение, свайп вниз, Esc), открывается поверх
// «Настройки персонажа». Текущий выбор закреплён сверху («Сейчас выбрана»), остальные — таблицей по
// характеристикам (choice-model.js). Телефон: нажатие раскрывает строку на месте (одна за раз), в
// ней подробности и «Выбрать: …». Компьютер: нажатие выделяет строку, подробности и кнопка — в
// панели справа. Выбор применяют chooseRace / chooseSpec / chooseSpec2 (character-generator.js);
// закрытие окна без «Выбрать» ничего не меняет. У специализаций в подробностях — обзорное дерево
// талантов (tree-preview.js): на компьютере всегда, на телефоне — под кнопкой «Дерево талантов».
// Все названия и тексты — только textContent.
const byId = id => document.getElementById(id);
const TITLES = { race: 'Выбор расы', career: 'Выбор карьеры', spec: 'Специализация', spec2: 'Вторая специализация' };
const NAME_COLUMN = { race: 'Раса · XP', career: 'Карьера', spec: 'Спека', spec2: 'Спека' };
const SHEET = 'choice-picker';

let kind = 'race';            // 'race' | 'career' | 'spec' | 'spec2'
let stepCareer = null;        // шаг «карьера → специализация»: выбранная, но не применённая карьера
let activeId = null;          // раскрытая (телефон) или выделенная (компьютер) строка
let openSections = new Set(); // раскрытые разделы-карьеры «Спеки 2» (вне поиска)
let treeOpen = false;         // телефон: дерево талантов раскрыто — одно состояние на окно, до его закрытия

const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;
const isShown = () => !byId(SHEET).classList.contains('hidden');
const selected = id => byId(id).value;

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function openChoicePicker(nextKind) {
    kind = nextKind;
    stepCareer = null;
    activeId = null;
    treeOpen = false;
    openSections = new Set([selected('gen-career')]);
    byId('choice-picker-search').value = '';
    openSheet(SHEET);
    renderChoicePicker();
    byId('choice-picker-list').scrollTop = 0;
    // «Спека 2» на компьютере — сразу в поиск; иначе фокус на «×» (на телефоне клавиатура закрыла бы список)
    if (kind === 'spec2' && isDesktop()) byId('choice-picker-search').focus();
}

// «‹ Карьеры»: назад со шага специализации к списку карьер, просмотренная карьера остаётся раскрытой
export function choicePickerBack() {
    kind = 'career';
    activeId = stepCareer;
    stepCareer = null;
    renderChoicePicker();
    byId('choice-picker-list').scrollTop = 0;
    focusRow(activeId);
}

// Вид окна: { current, sections: [{ id, name, own, rows }], listCap, searching }. У расы, карьеры
// и специализации раздел один и без заголовка (id: null)
function buildView() {
    const { races, careers } = state.db;
    const flat = (view, listCap) => ({ current: view.current, sections: [{ id: null, rows: view.rows }], listCap, searching: false });
    if (kind === 'race') return flat(raceView(races, selected('gen-race')), 'Все расы');
    if (kind === 'career') return flat(careerView(careers, selected('gen-career')), 'Все карьеры');
    if (kind === 'spec') {
        const view = specView(careers, stepCareer ?? selected('gen-career'), { specId: selected('gen-spec'), spec2Id: selected('gen-spec2'), pin: !stepCareer });
        return flat(view, view.careerName);
    }
    return spec2View(careers, { careerId: selected('gen-career'), specId: selected('gen-spec'), spec2Id: selected('gen-spec2'), query: byId('choice-picker-search').value });
}

const sectionOpen = (view, section) => section.id === null || view.searching || openSections.has(section.id);

export function renderChoicePicker() {
    const desk = isDesktop();
    const view = buildView();
    byId('choice-picker-title').textContent = TITLES[kind];
    byId('choice-picker-back').classList.toggle('hidden', !(kind === 'spec' && stepCareer));
    byId('choice-picker-search').classList.toggle('hidden', kind !== 'spec2');

    // Строки, до которых можно дойти: закреплённая (выделяется только на компьютере) и строки раскрытых разделов
    const reachable = [...(desk && view.current ? [view.current] : []), ...view.sections.filter(s => sectionOpen(view, s)).flatMap(s => s.rows)];
    if (!reachable.some(r => r.id === activeId)) {
        // На компьютере панель справа не пустует: текущий выбор, иначе первая строка, которую можно выбрать
        activeId = desk ? (view.current ?? reachable.find(r => !r.disabled) ?? reachable[0])?.id ?? null : null;
    }
    const active = reachable.find(r => r.id === activeId) ?? null;

    // Блок над списком не прокручивается: «Сейчас выбрана», заголовки столбцов, текущая строка
    const top = [];
    if (view.current) {
        top.push(el('p', 'choice-cap choice-cap-now', 'Сейчас выбрана'), headRow(), rowElement(view.current, { pinned: true, desk }));
        if (kind === 'spec2') {
            const remove = el('button', 'choice-remove', '✕ Убрать вторую специализацию');
            remove.type = 'button';
            remove.addEventListener('click', () => chooseSpec2('none', closeSheet));
            top.push(remove);
        }
    } else {
        if (kind === 'spec2') top.push(el('p', 'choice-none', 'Вторая специализация не выбрана'));
        top.push(headRow());
    }
    if (view.listCap) top.push(el('p', 'choice-cap', view.listCap));
    byId('choice-picker-current').replaceChildren(...top);

    const list = [];
    for (const section of view.sections) {
        const open = sectionOpen(view, section);
        if (section.id !== null) list.push(sectionHeader(section, open));
        if (!open) continue;
        for (const row of section.rows) {
            list.push(rowElement(row, { pinned: false, desk }));
            if (!desk && row.id === activeId) list.push(detailElement(row, 'choice-inline', false));
        }
    }
    if (!view.sections.length) list.push(el('p', 'picker-empty', 'Ничего не найдено.'));
    byId('choice-picker-list').replaceChildren(...list);

    byId('choice-picker-detail').replaceChildren(...(desk && active ? [detailElement(active, 'choice-panel', active.id === view.current?.id)] : []));
}

function headRow() {
    const row = el('div', 'choice-row choice-head');
    row.setAttribute('aria-hidden', 'true');
    row.append(el('span', 'choice-name', NAME_COLUMN[kind]),
        ...STAT_ORDER.map(key => el('span', `choice-cell choice-c-${key}`, STAT_CONFIG[key].abbr)));
    return row;
}

// Имя строки для экранной читалки: название, приписка и шесть значений с названиями характеристик
function rowLabel(row) {
    const cells = row.cells.map(c => `${STAT_CONFIG[c.key].abbr} ${c.text === '·' ? 0 : c.text}`).join(', ');
    return `${row.name}${row.note ? `, ${row.note}` : ''}. ${cells}`;
}

// Строка таблицы. Закреплённая строка на телефоне не раскрывается (это не кнопка); на компьютере
// она выделяется, как остальные
function rowElement(row, { pinned, desk }) {
    const button = desk || !pinned;
    const node = el(button ? 'button' : 'div', 'choice-row');
    node.classList.toggle('choice-pinned', pinned);
    node.classList.toggle('choice-off', row.disabled);
    node.classList.toggle('choice-active', row.id === activeId);
    node.dataset.choice = row.id;
    node.setAttribute('aria-label', rowLabel(row));
    if (button) {
        node.type = 'button';
        if (!desk) node.setAttribute('aria-expanded', String(row.id === activeId));
        else if (row.id === activeId) node.setAttribute('aria-current', 'true');
        node.addEventListener('click', () => activate(row.id));
    } else {
        node.setAttribute('role', 'group');
    }
    const name = el('span', 'choice-name', row.name);
    if (row.note) name.append(el('span', `choice-note choice-note-${row.noteTone}`, row.note));
    node.append(name, ...row.cells.map(c => el('span', `choice-cell choice-${c.tone}${c.tone === 'strong' ? ` choice-c-${c.key}` : ''}`, c.text)));
    return node;
}

function sectionHeader(section, open) {
    const head = el('button', 'choice-section');
    head.type = 'button';
    head.dataset.section = section.id;
    head.setAttribute('aria-expanded', String(open));
    const name = el('span', 'choice-section-name', section.name);
    if (section.own) name.append(' ', el('span', 'choice-own', '· ваша карьера'));
    const count = el('span', 'choice-count', `${section.rows.length} `);
    const chevron = el('span', '', open ? '▴' : '▾');
    chevron.setAttribute('aria-hidden', 'true');
    count.append(chevron);
    head.append(name, count);
    head.addEventListener('click', () => {
        if (openSections.has(section.id)) openSections.delete(section.id); else openSections.add(section.id);
        renderChoicePicker();
        byId('choice-picker-list').querySelector(`[data-section="${CSS.escape(section.id)}"]`)?.focus();
    });
    return head;
}

function skillsElement(label, skills) {
    const list = el('div', 'choice-skills');
    list.append(...skills.map(skill => {
        const item = el('span', 'choice-skill');
        const dot = el('i', `choice-dot${skill.char ? ` choice-c-${skill.char}` : ''}`);
        dot.setAttribute('aria-hidden', 'true');
        item.append(dot, skill.name);
        return item;
    }));
    return [el('p', 'choice-label', label), list];
}

// Обзорное дерево талантов специализации. Компьютер: подпись и дерево. Телефон: кнопка
// «Дерево талантов» и, если раскрыто, дерево — состояние сохраняется при переходе к другой строке.
// Нет дерева в справочнике — ничего
function treeElements(row, wide) {
    const tree = treePreviewElement(TALENTS_DB[row.id], row.name);
    if (!tree) return [];
    if (wide) return [el('p', 'choice-label', 'Дерево талантов'), tree];
    const toggle = el('button', 'choice-tree-toggle', 'Дерево талантов');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', String(treeOpen));
    const chevron = el('span', '', treeOpen ? '▴' : '▾');
    chevron.setAttribute('aria-hidden', 'true');
    toggle.append(chevron);
    toggle.addEventListener('click', () => {
        treeOpen = !treeOpen;
        renderChoicePicker();
        const next = byId('choice-picker-list').querySelector('.choice-tree-toggle');
        next?.focus();
        // как в activate: подробности видны целиком, если помещаются; если нет — видна сама строка
        const inline = next?.closest('.choice-inline');
        if (inline) { inline.scrollIntoView({ block: 'nearest' }); inline.previousElementSibling.scrollIntoView({ block: 'nearest' }); }
    });
    return treeOpen ? [toggle, tree] : [toggle];
}

function thresholdLine(row) {
    const line = el('p', 'choice-thr');
    const part = (label, t, abbr) => [`${label} `, el('b', '', String(t.total)), ' ', el('small', '', `(${t.base} + ${abbr} ${t.stat})`)];
    line.append(...part('Раны', row.wounds, STAT_CONFIG.brawn.abbr), ' · ', ...part('Усталость', row.strain, STAT_CONFIG.willpower.abbr));
    return line;
}

// Подробности строки: под раскрытой строкой (телефон) или в панели справа (компьютер, wide) — там
// ещё крупное название и шесть плиток. isCurrent — строка блока «Сейчас выбрана»
function detailElement(row, className, isCurrent) {
    const wide = className === 'choice-panel';
    const box = el('div', className);
    if (wide) {
        const tiles = el('div', 'choice-tiles');
        tiles.append(...row.cells.map(c => {
            const tile = el('div', `choice-tile choice-c-${c.key}`, STAT_CONFIG[c.key].abbr);
            tile.append(el('b', '', c.text));
            return tile;
        }));
        box.append(el('p', 'choice-panel-name', row.name), tiles);
    }
    if (row.kind === 'race') {
        box.append(thresholdLine(row));
        if (wide) {
            const xp = el('p', 'choice-text', 'Стартовый XP: ');
            xp.append(el('b', '', String(row.startXP)));
            box.append(xp);
        }
        if (row.special) {
            if (wide) box.append(el('p', 'choice-label', 'Способности'));
            box.append(el('p', 'choice-text', row.special));
        }
    } else {
        if (row.description) box.append(el('p', 'choice-text choice-desc', row.description));
        box.append(...skillsElement(row.kind === 'career' ? 'Карьерные навыки' : 'Бонусные навыки', row.skills));
        if (row.kind === 'spec') box.append(...treeElements(row, wide));
        if (row.kind === 'career') box.append(el('p', 'choice-label', 'Специализации'), el('p', 'choice-text', row.specNames.join(' · ')));
    }
    if (isCurrent) box.append(el('p', 'choice-now', 'Сейчас выбрана'));
    else if (row.disabled) box.append(el('p', 'choice-now', `Уже выбрана: ${row.note}`));
    else {
        const pickButton = el('button', 'choice-pick', `Выбрать: ${row.name}`);
        pickButton.type = 'button';
        pickButton.addEventListener('click', () => pick(row));
        box.append(pickButton);
    }
    return box;
}

function focusRow(id) {
    if (id === null) return;
    [...byId(SHEET).querySelectorAll('.choice-row[data-choice]')].find(n => n.dataset.choice === id)?.focus();
}

// Телефон: раскрыть строку (повторное нажатие сворачивает). Компьютер: выделить строку
function activate(id) {
    activeId = !isDesktop() && activeId === id ? null : id;
    renderChoicePicker();
    focusRow(id);
    // Раскрытая строка видна целиком, если помещается; если нет — видна сама строка, подробности прокручиваются
    const inline = byId('choice-picker-list').querySelector('.choice-inline');
    if (inline) { inline.scrollIntoView({ block: 'nearest' }); inline.previousElementSibling.scrollIntoView({ block: 'nearest' }); }
}

function pick(row) {
    if (kind === 'race') chooseRace(row.id, closeSheet);
    else if (kind === 'spec') chooseSpec(stepCareer ?? selected('gen-career'), row.id, closeSheet);
    else if (kind === 'spec2') chooseSpec2(row.id, closeSheet);
    else {
        // Карьера не применяется сразу: дальше — выбор её специализации, применяются вместе
        stepCareer = row.id;
        kind = 'spec';
        activeId = null;
        renderChoicePicker();
        byId('choice-picker-list').scrollTop = 0;
        byId('choice-picker-back').focus();
    }
}

// Компьютер: стрелки ↑/↓ переводят фокус и выделение на соседнюю строку
byId(SHEET).addEventListener('keydown', (e) => {
    if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || !isDesktop() || !e.target.closest('.choice-row')) return;
    e.preventDefault();
    const ids = [...byId(SHEET).querySelectorAll('.choice-row[data-choice]')].map(n => n.dataset.choice);
    const next = neighborId(ids, e.target.closest('.choice-row').dataset.choice, e.key === 'ArrowDown' ? 1 : -1);
    if (next === null || next === activeId) return;
    activeId = next;
    renderChoicePicker();
    focusRow(next);
});

// Окно открыто, а раскладка сменилась (поворот, размер окна): раскрытая строка ↔ панель справа
window.matchMedia(DESKTOP_QUERY).addEventListener('change', () => { if (isShown()) renderChoicePicker(); });
