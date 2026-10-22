import { state } from './state.js';
import { openSheet, closeSheet } from './bottom-sheet.js';
import { showDialog } from './ui-utils.js';
import { listCharacters } from './character-store.js';
import { listView, transferHint, CHARACTER_LIMIT } from './character-list-model.js';
import { openCharacter, newCharacter, importCharacter, removeCharacter, characterFile, currentCharacterId, listedCharacters } from './character-session.js';

// Окно «Персонажи» (подпроект 4б, макеты character-list-layout.html — вариант A,
// character-list-states.html). На телефоне — шторка снизу, на компьютере — окно по центру
// (bottom-sheet.js). Строка: кружок с инициалами, имя, «Раса · Карьера: Специализация», метка
// «открыт», у персонажа в кампании — её название; «⋯» раскрывает под строкой «Сохранить в файл» и «Удалить». Внизу «+ Новый» и «Импорт
// из файла». Пока никто не открыт, окно заперто (нет «×», не закрывается). Перенос из браузера,
// упёршийся в предел 20, — подсказка над списком и счётчик «N из 20» в заголовке (мелочи 4б, п. 3).
// Имена — только textContent.
const byId = id => document.getElementById(id);
const TEXT = {
    loading: 'Загрузка…',
    failed: 'Не удалось загрузить список. Проверьте подключение к интернету.',
    empty: 'Персонажей пока нет.',
    emptyNote: 'Создайте нового или загрузите из файла.',
    limit: `Достигнут предел — ${CHARACTER_LIMIT} персонажей`,
};

let rows = [];
let menuFor = null;   // id строки с раскрытым «⋯»
let busy = false;     // идёт действие (открытие, создание, удаление) — кнопки не нажимаются
let wired = false;
// Перенос из браузера, упёршийся в предел 20 (character-session.js offerTransfer): { name, move,
// decline } — подсказка над списком и счётчик «N из 20»; null — окно без подсказки. Живёт, пока
// открыто окно, которое открыл перенос
let transfer = null;

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// Действие окна: одно за раз; кнопки неактивны, пока оно идёт
async function run(action) {
    if (busy) return;
    busy = true;
    render();
    try { await action(); } finally { busy = false; render(); }
}

function confirmRemove(row) {
    showDialog({
        message: `Удалить персонажа «${row.name}»?`,
        note: 'Это нельзя отменить. Чтобы оставить копию, сначала сохраните его в файл.',
        confirm: 'Удалить', cancel: 'Отмена', danger: true,
        onConfirm: () => run(async () => {
            if (!await removeCharacter(row.id)) return;
            rows = rows.filter(r => r.id !== row.id);
            menuFor = null;
        }),
    });
}

function rowElement(row) {
    const item = el('div', 'charlist-item' + (row.current ? ' charlist-current' : ''));
    item.dataset.character = row.id;
    const main = el('button', 'charlist-row');
    main.type = 'button';
    main.disabled = busy;
    main.append(el('span', 'charlist-av', row.initials));
    const text = el('span', 'charlist-text');
    text.append(el('b', 'charlist-name', row.name));
    if (row.subtitle) text.append(el('span', 'charlist-sub', row.subtitle));
    // Кампания персонажа (4.1)
    if (row.campaign) text.append(el('span', 'charlist-camp', `⚑ ${row.campaign}`));
    if (row.current) text.append(el('span', 'charlist-tag', 'открыт'));
    main.append(text);
    main.addEventListener('click', () => {
        if (row.current) { closeSheet(); return; }
        run(() => openCharacter(row.id));
    });
    const more = el('button', 'charlist-more', '⋯');
    more.type = 'button';
    more.disabled = busy;
    more.setAttribute('aria-label', `Действия: ${row.name}`);
    more.setAttribute('aria-expanded', String(menuFor === row.id));
    more.addEventListener('click', () => { menuFor = menuFor === row.id ? null : row.id; render(); });
    const head = el('div', 'charlist-head');
    head.append(main, more);
    item.append(head);
    if (menuFor === row.id) {
        const menu = el('div', 'charlist-menu');
        const file = el('button', 'charlist-menu-btn', 'Сохранить в файл');
        file.type = 'button';
        file.disabled = busy;
        file.addEventListener('click', () => run(() => characterFile(row.id)));
        const remove = el('button', 'charlist-menu-btn charlist-danger', 'Удалить');
        remove.type = 'button';
        remove.disabled = busy;
        remove.addEventListener('click', () => confirmRemove(row));
        menu.append(file, remove);
        item.append(menu);
    }
    return item;
}

function render() {
    const view = listView(rows, state.db, currentCharacterId());
    const list = byId('character-list-rows');
    if (view.empty) {
        const empty = el('p', 'charlist-empty', TEXT.empty);
        empty.append(el('br'), document.createTextNode(TEXT.emptyNote));
        list.replaceChildren(empty);
    } else {
        list.replaceChildren(...view.rows.map(rowElement));
    }
    byId('character-list-limit').classList.toggle('hidden', !view.atLimit);
    byId('character-list-new').disabled = busy || view.atLimit;
    byId('character-list-import').disabled = busy || view.atLimit;
    renderTransfer(rows.length);
}

// Подсказка переноса и счётчик в заголовке; count — сколько персонажей (null — список не загружен)
function renderTransfer(count) {
    const hint = transfer && count !== null ? transferHint(count, transfer.name) : null;
    byId('character-list-transfer').classList.toggle('hidden', !hint);
    byId('character-list-count').classList.toggle('hidden', !hint);
    if (!hint) return;
    byId('character-list-count').textContent = hint.counter;
    byId('character-list-transfer-text').textContent = hint.text;
    byId('character-list-transfer-yes').disabled = busy || !hint.canTransfer;
    byId('character-list-transfer-no').disabled = busy;
}

function wire() {
    if (wired) return;
    wired = true;
    // «Перенести»: создан — открыт, окно закрыто (present), ответ «yes» запомнен; нет — сообщение,
    // подсказка остаётся. «Не переносить»: ответ «no» запомнен, подсказка исчезает, окно остаётся
    byId('character-list-transfer-yes').addEventListener('click', () => run(async () => {
        if (transfer && await transfer.move()) transfer = null;
    }));
    byId('character-list-transfer-no').addEventListener('click', () => {
        if (busy || !transfer) return;
        transfer.decline();
        transfer = null;
        render();
    });
    byId('character-list-new').addEventListener('click', () => run(newCharacter));
    const file = byId('character-list-file');
    byId('character-list-import').addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
        const chosen = file.files[0];
        file.value = '';
        if (chosen) run(() => importCharacter(chosen));
    });
}

// Открыть окно и загрузить список. locked — никто не открыт: окно не закрывается, пока персонаж
// не выбран, не создан или не загружен. offer — перенос из браузера на пределе (подсказка). Без
// offer подсказка остаётся, только если окно уже открыто (удалён открытый персонаж — окно
// открывается заново запертым); окно, открытое заново после закрытия, — без подсказки
export async function openCharacterList({ locked = false, transfer: offer = null } = {}) {
    wire();
    menuFor = null;
    transfer = offer ?? (byId('character-list').classList.contains('hidden') ? null : transfer);
    openSheet('character-list', { locked });
    renderTransfer(null);
    const list = byId('character-list-rows');
    list.replaceChildren(el('p', 'charlist-empty', TEXT.loading));
    const listed = await listCharacters();
    if (!listed.ok) {
        const retry = el('button', 'charlist-btn', 'Повторить');
        retry.type = 'button';
        retry.addEventListener('click', () => openCharacterList({ locked }));
        list.replaceChildren(el('p', 'charlist-empty', TEXT.failed), retry);
        return;
    }
    rows = listed.rows;
    // Персонаж, чьё создание было «неясным», виден в списке — повтор создаст нового («Надёжная запись»)
    listedCharacters(rows);
    render();
}
