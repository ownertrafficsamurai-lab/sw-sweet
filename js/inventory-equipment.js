import { state } from './state.js';
import { saveSession } from './persistence.js';
import { maxEncumbrance } from './stat-info.js';
import { CATALOG } from './reference-data.js';
import { COMBAT_SKILLS_LIST, skillPool } from './skills.js';
import { formatDesc, showConfirm, showAlert } from './ui-utils.js';
import { LIMITS } from './save-check.js';
import { getDerivedStats, diceHtml } from './character-generator.js';
import { renderHudCard } from './hud-card.js';
import { iconKey, iconElement } from './item-icons.js';
import {
    RANGE_LABELS, resolveItem, itemEncumbrance, totalEncumbrance, weaponDamage, critLabel, useLabel,
    addFromCatalog, newCustomItem, makeCustom, useItem, wearArmor, removeItem, countWeapons,
    parseQualities, qualityLabel, qualitySource, readNumber,
} from './inventory.js';

// Вкладка «Снаряжение» (подпроект Б1, спека 2026-09-30-equipment-catalog.md): разделы «Оружие»,
// «Броня», «Снаряжение»; строка предмета раскрывается на месте (раскрыта одна). Расчёты — в
// inventory.js; окно «+ Добавить» — catalog-picker.js. Ввод пользователя (названия, свойства,
// заметки, эффекты своих предметов) выводится только через textContent / value; тексты каталога и
// словаря свойств (note, effect, description — пишет только admin) — через formatDesc.
const byId = id => document.getElementById(id);
const SECTIONS = [
    { type: 'weapon', list: 'inv-weapon-list', empty: 'Нет оружия.' },
    { type: 'armor', list: 'inv-armor-list', empty: 'Нет брони.' },
    { type: 'gear', list: 'inv-gear-list', empty: 'Нет снаряжения.' },
];

// Раскрытая строка (id предмета) и открытая расшифровка свойства (номер чипа в ней). Живут до
// перезагрузки и смены вкладки, в сохранение не попадают
let openItem = null;
let openQuality = null;

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function button(className, text, onClick) {
    const b = el('button', className, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
}

const rowSelector = id => `[data-item="${CSS.escape(id)}"]`;

// ---- Изменения ----

function updateItem(id, change) {
    state.inventory.items = state.inventory.items.map(it => (it.id === id ? change(it) : it));
}

function setCustom(id, patch) {
    updateItem(id, it => ({ ...it, custom: { ...it.custom, ...patch } }));
}

// После изменения: сохранить, перерисовать вкладку (фокус — на тот же элемент строки по его
// data-focus) и карточку персонажа (поглощение и защита зависят от брони). Кнопка стала
// неактивной («Исп.» и «−» у последнего расходника) — фокус на «+» той же строки
function commit(id, focusKey) {
    saveSession();
    renderInventory();
    renderHudCard();
    if (!id || !focusKey) return;
    const row = document.querySelector(rowSelector(id));
    const target = row?.querySelector(`[data-focus="${focusKey}"]`);
    (target && !target.disabled ? target : row?.querySelector('[data-focus="more"]'))?.focus();
}

// Число своего предмета: строка не перерисовывается — change приходит и при уходе из поля
// (щелчком — раньше, чем сам щелчок), и перерисовка отсоединила бы кнопку под курсором и вернула
// фокус в поле. Обновляются верх строки (статы, «×N»), нагрузка и карточка
function commitNumber(id) {
    saveSession();
    const row = document.querySelector(rowSelector(id));
    const item = state.inventory.items.find(it => it.id === id);
    if (row && item) {
        const fresh = itemRow(resolveItem(item, CATALOG), getDerivedStats());
        row.querySelector('.inv-head').replaceChildren(...fresh.querySelector('.inv-head').childNodes);
    }
    updateEncumbrance();
    renderHudCard();
}

function toggleItem(id) {
    openItem = openItem === id ? null : id;
    openQuality = null;
    renderInventory();
    document.querySelector(`${rowSelector(id)} .inv-head`)?.focus();
}

// Вкладка открыта заново — все строки свёрнуты (ui-utils.js switchTab)
export function showInventoryTab() {
    openItem = null;
    openQuality = null;
    renderInventory();
}

const ITEMS_FULL = `Достигнут предел — ${LIMITS.items} предметов`;

// Из окна «+ Добавить» (catalog-picker.js): предмет каталога по правилу повторного добавления
export function addCatalogItem(type, catalogId) {
    const row = CATALOG[type]?.[catalogId];
    if (!row) return null;
    const result = addFromCatalog(state.inventory.items, type, row);
    // Предел строк (save-check.js): ещё один расходник в ту же строку проходит всегда
    if (!result.merged && state.inventory.items.length >= LIMITS.items) { showAlert(ITEMS_FULL); return null; }
    state.inventory.items = result.items;
    commit();
    return { ...result, qty: result.items.find(it => it.id === result.id).qty };
}

// «✎ Своё …»: пустой свой предмет, его строка раскрыта, фокус — в поле названия
export function addCustomItem(type) {
    if (state.inventory.items.length >= LIMITS.items) { showAlert(ITEMS_FULL); return; }
    const result = newCustomItem(state.inventory.items, type);
    state.inventory.items = result.items;
    openItem = result.id;
    openQuality = null;
    commit();
    const name = document.querySelector(`${rowSelector(result.id)} [data-focus="name"]`);
    name?.scrollIntoView({ block: 'nearest' });
    name?.focus();
}

// ---- Отрисовка ----

export function renderInventory() {
    const derived = getDerivedStats();
    for (const section of SECTIONS) {
        const list = byId(section.list);
        if (!list) continue;
        const views = state.inventory.items.filter(it => it.item_type === section.type).map(it => resolveItem(it, CATALOG));
        list.replaceChildren(...(views.length ? views.map(v => itemRow(v, derived)) : [el('p', 'inv-empty', section.empty)]));
    }
    updateEncumbrance();
}

function itemRow(v, derived) {
    const open = v.id === openItem;
    const row = el('div', 'inv-item' + (open ? ' inv-open' : '') + (v.consumable && v.qty === 0 ? ' inv-spent' : ''));
    row.dataset.item = v.id;

    // Верх строки — кнопка раскрытия (как заголовки разделов «Способностей»)
    const head = el('div', 'inv-head');
    head.setAttribute('role', 'button');
    head.tabIndex = 0;
    head.setAttribute('aria-expanded', String(open));
    if (open) head.setAttribute('aria-controls', `inv-body-${v.id}`);
    const top = el('div', 'inv-top');
    top.append(el('span', 'inv-name', v.name || 'Без названия'));
    if (v.own) top.append(el('span', 'inv-tag', 'свой'));
    if (!v.consumable && v.qty > 1) top.append(el('span', 'inv-mult', `×${v.qty}`));
    // Шеврон — уголок из рамок CSS, без текста: повёрнутый глиф «›» шире своей строки
    const chev = el('span', 'inv-chev');
    chev.setAttribute('aria-hidden', 'true');
    top.append(chev);
    // Плашка с рисунком (item-icons.js) слева; у своего предмета — пунктирная
    const tile = el('span', 'inv-tile' + (v.own ? ' inv-tile-own' : ''));
    tile.append(iconElement(iconKey(v)));
    const main = el('div', 'inv-main');
    main.append(top);
    const stats = statsLine(v, derived);
    if (stats) main.append(stats);
    head.append(tile, main);
    head.addEventListener('click', () => toggleItem(v.id));
    head.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); // Space не прокручивает страницу
        toggleItem(v.id);
    });

    const line = el('div', 'inv-line');
    line.append(head);
    const controls = rowControls(v);
    if (controls) line.append(controls);
    row.append(line);
    if (open) row.append(itemBody(v, derived));
    return row;
}

// Свёрнутая строка: оружие — навык, пул, урон, крит, дистанция; броня — защита и поглощение
function statsLine(v, derived) {
    if (v.missing) return null;
    const stats = el('div', 'inv-stats');
    if (v.type === 'weapon') {
        stats.append(el('span', '', v.skill || 'Навык —'));
        const pool = derived && v.skill ? skillPool(v.skill, { finalStats: derived.finalStats, skillRanks: state.skillRanks, lightsaberChar: state.lightsaberChar }) : null;
        if (pool) {
            const dice = el('span', 'inv-pool');
            dice.setAttribute('role', 'img');
            dice.setAttribute('aria-label', `Пул: ${pool.yellow} жёлт., ${pool.green} зел.`);
            dice.innerHTML = diceHtml(pool);
            stats.append(dice);
        }
        const damage = weaponDamage(v, derived ? derived.finalStats.brawn : 0);
        stats.append(labelled('Урон', damage ?? '—', 'b'), labelled('Крит', critLabel(v.crit), 'i'), el('span', '', RANGE_LABELS[v.range] || '—'));
        return stats;
    }
    if (v.type === 'armor') {
        stats.append(labelled('ЗАЩ', v.defense, 'b'), el('span', '', '·'), labelled('ПОГЛ', v.soak, 'b'));
        return stats;
    }
    return null;
}

function labelled(label, value, tag) {
    const span = el('span', '', `${label} `);
    span.append(el(tag, '', String(value)));
    return span;
}

// Справа от верха строки: у брони — «Надета» / «Надеть», у расходника — «− N +» и «Исп.» / «Бросить»
function rowControls(v) {
    if (v.type === 'armor' && !v.missing) {
        const ctrl = el('div', 'inv-ctrl');
        const worn = button('inv-btn inv-worn', v.worn ? 'Надета' : 'Надеть', () => {
            state.inventory.items = wearArmor(state.inventory.items, v.id, !v.worn);
            commit(v.id, 'worn');
        });
        worn.dataset.focus = 'worn';
        worn.setAttribute('aria-pressed', String(v.worn));
        worn.setAttribute('aria-label', `${v.worn ? 'Надета' : 'Надеть'}: ${v.name || 'Без названия'}`);
        ctrl.append(worn);
        return ctrl;
    }
    if (!v.consumable) return null;
    const ctrl = el('div', 'inv-ctrl');
    const name = v.name || 'Без названия';
    const less = button('inv-btn', '−', () => { updateItem(v.id, useItem); commit(v.id, 'less'); });
    less.dataset.focus = 'less';
    less.disabled = v.qty === 0;
    less.setAttribute('aria-label', `Меньше: ${name}`);
    const qty = el('span', 'inv-count hud-num', String(v.qty));
    qty.setAttribute('aria-label', `Осталось: ${v.qty}`);
    const more = button('inv-btn', '+', () => { updateItem(v.id, it => ({ ...it, qty: it.qty + 1 })); commit(v.id, 'more'); });
    more.dataset.focus = 'more';
    more.setAttribute('aria-label', `Больше: ${name}`);
    const use = button('inv-btn inv-use', useLabel(v), () => { updateItem(v.id, useItem); commit(v.id, 'use'); });
    use.dataset.focus = 'use';
    use.disabled = v.qty === 0;
    use.setAttribute('aria-label', `${useLabel(v)}: ${name}`);
    ctrl.append(less, qty, more, use);
    return ctrl;
}

function itemBody(v, derived) {
    const body = el('div', 'inv-body');
    body.id = `inv-body-${v.id}`;
    if (v.missing) {
        body.append(el('p', 'inv-text', 'Этого предмета больше нет в каталоге. Его можно удалить.'));
    } else if (v.own) {
        body.append(...ownFields(v));
    } else {
        body.append(...catalogDetails(v, derived));
    }
    if (v.type === 'gear' && !v.consumable && !v.missing) body.append(numberField(v, 'Кол-во', 'qty', v.qty, { onChange: n => updateItem(v.id, it => ({ ...it, qty: n })) }));
    body.append(textField(v, 'Заметки', 'notes', v.notes, value => updateItem(v.id, it => ({ ...it, notes: value })), { area: true }));
    if (v.own) {
        const box = el('label', 'inv-check');
        const check = el('input');
        check.type = 'checkbox';
        check.checked = v.consumable;
        check.dataset.focus = 'consumable';
        check.addEventListener('change', () => { updateItem(v.id, it => ({ ...it, consumable: check.checked })); commit(v.id, 'consumable'); });
        box.append(check, el('span', '', 'расходуемый'));
        body.append(box);
    }
    const actions = el('div', 'inv-actions');
    if (!v.own && !v.missing) {
        const own = button('inv-btn', 'Сделать своим', () => { updateItem(v.id, it => makeCustom(it, CATALOG)); commit(v.id, 'name'); });
        actions.append(own);
    }
    actions.append(button('inv-btn inv-del', 'Удалить', () => {
        showConfirm(`Удалить «${v.name || 'Без названия'}»?`, () => {
            state.inventory.items = removeItem(state.inventory.items, v.id);
            if (openItem === v.id) openItem = null;
            commit();
            // Строки больше нет — фокус на «+ Добавить» её раздела
            document.querySelector(`#inv-${v.type} .inv-sec-head button`)?.focus();
        });
    }));
    body.append(actions);
    const fold = button('inv-fold', '▴ Свернуть', () => toggleItem(v.id));
    body.append(fold);
    return body;
}

// Каталожный предмет: свойства с расшифровкой, строка фактов, пояснение каталога
function catalogDetails(v, derived) {
    const parts = [];
    if (v.type === 'weapon') {
        const chips = qualityChips(v);
        if (chips) parts.push(chips);
        if (v.damageAddsBrawn && derived) parts.push(el('p', 'inv-facts', `Урон ${v.damage} + Физ. сила ${derived.finalStats.brawn}`));
    }
    const facts = [`Груз ${v.type === 'armor' && v.worn ? `${v.encumbrance} → ${itemEncumbrance({ ...v, qty: 1 })}` : v.encumbrance ?? '—'}`];
    if (v.price != null) facts.push(`${v.price} кр.`);
    if (v.rarity != null) facts.push(`редкость ${v.rarity}`);
    const factLine = el('p', 'inv-facts', facts.join(' · '));
    if (v.restricted) factLine.append(' · ', el('span', 'inv-r', 'R'));
    parts.push(factLine);
    const info = v.type === 'weapon' ? v.note : v.type === 'gear' ? v.effect : '';
    if (info) {
        const p = el('p', 'inv-text');
        p.innerHTML = formatDesc(info);
        parts.push(p);
    }
    return parts;
}

// Чипы свойств: известное свойство — кнопка с ⓘ, нажатие показывает расшифровку строкой под
// чипами (одну за раз, повторное нажатие прячет); нераспознанный кусок своего текста — просто текст
function qualityChips(v) {
    const parsed = parseQualities(v.special, CATALOG.qualities);
    if (!parsed.length) return null;
    const wrap = el('div', 'inv-qualities');
    const chips = el('div', 'inv-chips');
    parsed.forEach((p, i) => {
        if (!p.quality) { chips.append(el('span', 'inv-chip inv-chip-raw', p.text)); return; }
        const open = v.id === openItem && openQuality === i;
        const chip = button('inv-chip', qualityLabel(p), () => {
            openQuality = openQuality === i ? null : i;
            renderInventory();
            document.querySelector(`${rowSelector(v.id)} [data-focus="q${i}"]`)?.focus();
        });
        chip.dataset.focus = `q${i}`;
        chip.setAttribute('aria-expanded', String(open));
        const info = el('span', 'inv-chip-i', 'ⓘ');
        info.setAttribute('aria-hidden', 'true');
        chip.append(' ', info);
        chips.append(chip);
    });
    wrap.append(chips);
    const shown = openQuality !== null && v.id === openItem ? parsed[openQuality] : null;
    if (shown?.quality) {
        const desc = el('div', 'inv-qdesc');
        const text = el('span');
        text.innerHTML = formatDesc(shown.quality.description);
        desc.append(text, el('span', 'inv-qsrc', qualitySource(shown.quality)));
        wrap.append(desc);
    }
    return wrap;
}

// ---- Поля своего предмета ----

function ownFields(v) {
    const fields = [textField(v, 'Название', 'name', v.name, value => {
        setCustom(v.id, { name: value });
        const name = document.querySelector(`${rowSelector(v.id)} .inv-name`);
        if (name) name.textContent = value || 'Без названия';
    }, { wide: true })];
    const grid = el('div', 'inv-fields');
    if (v.type === 'weapon') {
        grid.append(
            selectField(v, 'Навык', 'skill', v.skill ?? '', [['', '—'], ...COMBAT_SKILLS_LIST.map(s => [s, s])], value => setCustom(v.id, { skill: value || null })),
            numberField(v, 'Урон', 'damage', v.damage, { onChange: n => setCustom(v.id, { damage: n }) }),
            numberField(v, 'Крит', 'crit', v.crit, { min: 1, optional: true, onChange: n => setCustom(v.id, { crit: n }) }),
            selectField(v, 'Дист', 'range', v.range, Object.entries(RANGE_LABELS), value => setCustom(v.id, { range: value })),
            numberField(v, 'Груз', 'encumbrance', v.encumbrance, { onChange: n => setCustom(v.id, { encumbrance: n }) }),
        );
        const brawn = el('label', 'inv-check');
        const check = el('input');
        check.type = 'checkbox';
        check.checked = v.damageAddsBrawn;
        check.dataset.focus = 'brawn';
        check.addEventListener('change', () => { setCustom(v.id, { damage_adds_brawn: check.checked }); commit(v.id, 'brawn'); });
        brawn.append(check, el('span', '', '+ Физ. сила к урону'));
        fields.push(grid, brawn);
        // Свойства — текст; под полем те же чипы, что у каталожного (обновляются при вводе)
        fields.push(textField(v, 'Свойства', 'special', v.special, value => {
            setCustom(v.id, { special: value });
            const fresh = qualityChips(resolveItem(state.inventory.items.find(it => it.id === v.id), CATALOG));
            const row = document.querySelector(rowSelector(v.id));
            const old = row?.querySelector('.inv-qualities');
            if (old && fresh) old.replaceWith(fresh);
            else if (old) old.remove();
            else if (fresh) row?.querySelector('[data-focus="special"]')?.closest('.inv-field').after(fresh);
        }, { wide: true, placeholder: 'Точное 1, Пробивающее 2' }));
        const chips = qualityChips(v);
        if (chips) fields.push(chips);
        return fields;
    }
    if (v.type === 'armor') {
        grid.append(
            numberField(v, 'Защита', 'defense', v.defense, { onChange: n => setCustom(v.id, { defense: n }) }),
            numberField(v, 'Поглощ.', 'soak', v.soak, { onChange: n => setCustom(v.id, { soak: n }) }),
            numberField(v, 'Груз', 'encumbrance', v.encumbrance, { onChange: n => setCustom(v.id, { encumbrance: n }) }),
        );
        fields.push(grid);
        return fields;
    }
    grid.append(numberField(v, 'Груз', 'encumbrance', v.encumbrance, { optional: true, onChange: n => setCustom(v.id, { encumbrance: n }) }));
    fields.push(grid, textField(v, 'Эффект', 'effect', v.effect, value => setCustom(v.id, { effect: value }), { area: true }));
    return fields;
}

// Текст — сохраняется при вводе, строка не перерисовывается (фокус и курсор остаются)
function textField(v, label, key, value, onInput, { wide = false, area = false, placeholder = '' } = {}) {
    const field = el('label', 'inv-field' + (wide || area ? ' inv-field-wide' : ''));
    const input = el(area ? 'textarea' : 'input', 'inv-input');
    if (area) input.rows = 2; else input.type = 'text';
    input.value = value ?? '';
    input.placeholder = placeholder;
    // Все текстовые поля предмета — название, свойства, эффект, заметки (save-check.js)
    input.maxLength = LIMITS.itemText;
    input.dataset.focus = key;
    input.addEventListener('input', () => { onInput(input.value); saveSession(); });
    field.append(el('span', 'inv-label', label), input);
    return field;
}

// Число — применяется по change (стрелки, Enter, уход из поля) без перерисовки строки
// (commitNumber); в поле остаётся приведённое значение
function numberField(v, label, key, value, { min = 0, optional = false, onChange }) {
    const field = el('label', 'inv-field');
    const input = el('input', 'inv-input inv-num');
    input.type = 'number';
    input.min = String(min);
    input.value = value ?? '';
    if (optional) input.placeholder = '—';
    input.dataset.focus = key;
    input.addEventListener('change', () => {
        const n = readNumber(input.value, { min, optional });
        onChange(n);
        input.value = n ?? '';
        commitNumber(v.id);
    });
    field.append(el('span', 'inv-label', label), input);
    return field;
}

function selectField(v, label, key, value, options, onChange) {
    const field = el('label', 'inv-field');
    const select = el('select', 'inv-input');
    for (const [optValue, optLabel] of options) select.add(new Option(optLabel, optValue, false, optValue === value));
    select.dataset.focus = key;
    select.addEventListener('change', () => { onChange(select.value); commit(v.id, key); });
    field.append(el('span', 'inv-label', label), select);
    return field;
}

// ---- Кредиты, нагрузка, сводка на листе ----

// Кредиты: поле ввода на вкладке «Снаряжение». Раньше значение не попадало в
// state.inventory.credits и терялось после перезагрузки.
export function setCredits(value) {
    state.inventory.credits = Math.max(0, parseInt(value) || 0);
    updateInventorySummary();
    saveSession();
}

// Нагрузка — на вкладке «Снаряжение» (inv-enc-*) и в сводке на листе (sum-enc-*)
export function updateEncumbrance() {
    const race = state.db.races.find(r => r.id === document.getElementById('gen-race').value);
    const brawn = race ? (race.stats.brawn + (state.statMods.brawn || 0)) : 2;
    const maxEnc = maxEncumbrance(brawn);
    const curEnc = totalEncumbrance(state.inventory.items, CATALOG);
    const pct = maxEnc > 0 ? Math.min(100, (curEnc / maxEnc) * 100) : 0;
    const barClass = 'h-full transition-all duration-300 ' + (pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-game-yellow-500' : 'bg-green-500');
    for (const prefix of ['inv-enc', 'sum-enc']) {
        const curEl = document.getElementById(prefix + '-cur');
        const maxEl = document.getElementById(prefix + '-max');
        const barEl = document.getElementById(prefix + '-bar');
        if (curEl) curEl.textContent = curEnc;
        if (maxEl) maxEl.textContent = maxEnc;
        if (barEl) { barEl.style.width = pct + '%'; barEl.className = barClass; }
    }
    updateInventorySummary();
}

// Сводка на листе: кредиты и число предметов оружия (нагрузку заполняет updateEncumbrance)
export function updateInventorySummary() {
    const creditsEl = document.getElementById('sum-credits');
    const weaponsEl = document.getElementById('sum-weapons');
    if (creditsEl) creditsEl.textContent = state.inventory.credits || 0;
    if (weaponsEl) weaponsEl.textContent = countWeapons(state.inventory.items);
}
