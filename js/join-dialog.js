import { state } from './state.js';
import { openSheet, closeSheet } from './bottom-sheet.js';
import { showAlert } from './ui-utils.js';
import { sessionStore } from './storage.js';
import { listCharacters } from './character-store.js';
import { currentCharacterId, newCharacter, afterCharacterOpened } from './character-session.js';
import { findCampaign, joinCampaign } from './campaign-store.js';
import { normalizeCode, isCodeShape, pickView, foundSubline, joinedText, errorText, NEW_CHARACTER } from './campaigns-model.js';

// Окно «Вступить по коду» (4.1, макет join-flow.html): шаг 1 — поле кода и «Найти», шаг 2 —
// карточка кампании и «Кем играть» (свои персонажи; занятый в другой активной кампании недоступен;
// последняя строка — «Новый персонаж · создать и вступить») и «Вступить». Ссылка ?join=КОД
// открывает сразу шаг 2 поверх листа: код убирается из адреса и ждёт входа в sessionStorage.
// Имена — только textContent.
const byId = id => document.getElementById(id);
const JOIN_KEY = 'swrpg_join_code';
const TEXT = {
    titleCode: 'Вступить по коду',
    titlePick: 'Вступить в кампанию',
    badLink: 'Ссылка-приглашение повреждена',
    loading: 'Загрузка персонажей…',
    newName: 'Новый персонаж',
    newSub: 'создать и вступить',
    noneFree: 'Свободных персонажей нет, а новых не создать — достигнут предел 20.',
};

let code = null;        // нормализованный код найденной кампании
let found = null;       // { id, name, gm_name, members }
let characters = [];    // строки окна «Персонажи»
let selected = null;    // id выбранного персонажа или NEW_CHARACTER
let busy = false;
let blocked = false;   // too_many_attempts: «Найти» и «Вступить» неактивны до закрытия окна
let onJoined = () => {};
let wired = false;

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function setError(id, text) {
    byId(id).textContent = text ?? '';
    byId(id).classList.toggle('hidden', !text);
}

function setBusy(value) {
    busy = value;
    byId('join-find').disabled = value || blocked;
    byId('join-submit').disabled = value || blocked || selected === null;
    for (const input of byId('join-characters').querySelectorAll('input')) input.disabled = value || input.dataset.locked === '1';
}

function showStep(step) {
    byId('join-step-code').classList.toggle('hidden', step !== 'code');
    byId('join-step-pick').classList.toggle('hidden', step !== 'pick');
    byId('join-title').textContent = step === 'code' ? TEXT.titleCode : TEXT.titlePick;
}

function pickRow({ id, name, initialsText, sub, disabled }) {
    const row = el('label', 'camp-pick-row');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'join-character';
    radio.value = id;
    radio.checked = id === selected;
    radio.disabled = disabled || busy;
    radio.dataset.locked = disabled ? '1' : '0';
    radio.addEventListener('change', () => { selected = id; setBusy(busy); });
    const text = el('span', 'charlist-text');
    text.append(el('b', 'charlist-name', name));
    if (sub) text.append(el('span', 'charlist-sub', sub));
    row.append(radio, el('span', 'charlist-av', initialsText), text);
    return row;
}

function renderPick() {
    byId('join-found-name').textContent = found.name;
    byId('join-found-sub').textContent = foundSubline(found);
    const view = pickView(characters, state.db, found.id, currentCharacterId());
    if (selected === null || !view.items.concat([{ id: NEW_CHARACTER }]).some(i => i.id === selected && !i.disabled)) selected = view.selected;
    const rows = view.items.map(i => pickRow({ id: i.id, name: i.name, initialsText: i.initials, sub: i.sub, disabled: i.disabled }));
    if (view.canCreate) rows.push(pickRow({ id: NEW_CHARACTER, name: TEXT.newName, initialsText: '+', sub: TEXT.newSub, disabled: false }));
    if (!rows.length || selected === null) rows.push(el('p', 'camp-hint', TEXT.noneFree));
    byId('join-characters').replaceChildren(...rows);
    setBusy(busy);
}

// Свежий список своих персонажей (с их кампаниями) для шага 2
async function loadCharacters() {
    byId('join-characters').replaceChildren(el('p', 'camp-hint', TEXT.loading));
    byId('join-submit').disabled = true;
    const listed = await listCharacters();
    if (!listed.ok) {
        byId('join-characters').replaceChildren();
        setError('join-pick-error', errorText('network'));
        return false;
    }
    characters = listed.rows;
    renderPick();
    return true;
}

async function find(raw) {
    const normalized = normalizeCode(raw);
    setError('join-code-error', '');
    // Код не той формы — в базу не идёт (и не тратит попытку)
    if (!isCodeShape(normalized)) { setError('join-code-error', errorText('not_found')); return false; }
    setBusy(true);
    const result = await findCampaign(normalized);
    setBusy(false);
    if (!result.ok) {
        if (result.error === 'too_many_attempts') { blocked = true; setBusy(false); }
        setError('join-code-error', errorText(result.error));
        return false;
    }
    code = normalized;
    found = result.campaign;
    selected = null;
    setError('join-pick-error', '');
    showStep('pick');
    await loadCharacters();
    return true;
}

async function submit() {
    if (busy || selected === null) return;
    setError('join-pick-error', '');
    setBusy(true);
    let characterId = selected;
    let name = characters.find(c => c.id === selected)?.name;
    let created = false;
    if (selected === NEW_CHARACTER) {
        // Заготовка, как «+ Новый» в «Персонажах»: создаётся и открывается (окно закроется)
        if (!await newCharacter({ setup: false })) { setBusy(false); return; }
        characterId = currentCharacterId();
        name = '';
        created = true;
        // Дальше он — обычная строка «Кем играть»: повтор после потерянного ответа идёт им же
        // (база ответит успехом), а не первым свободным
        characters = [{ id: characterId, name: '', updated_at: new Date().toISOString() }, ...characters];
        selected = characterId;
    }
    const result = await joinCampaign(code, characterId);
    setBusy(false);
    if (result.ok) {
        closeSheet();
        onJoined(result.campaignId, joinedText(name, found.name));
        return;
    }
    const message = errorText(result.error, { character: name, campaign: result.campaignName });
    // Новый персонаж уже открыт, а окно закрылось — снова шаг 2 с ним
    if (created) { openSheet('join-sheet'); renderPick(); }
    setError('join-pick-error', message);
    // Код сменили или попытки кончились — «Вступить» больше не поможет
    if (result.error === 'too_many_attempts' || result.error === 'not_found') { blocked = true; setBusy(false); }
    if (result.error === 'already_in_campaign' || result.error === 'not_owner') await loadCharacters();
}

function wire() {
    if (wired) return;
    wired = true;
    const input = byId('join-code-input');
    byId('join-find').addEventListener('click', () => { if (!busy) find(input.value); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); byId('join-find').click(); } });
    input.addEventListener('input', () => { if (!blocked) setError('join-code-error', ''); });
    byId('join-submit').addEventListener('click', submit);
}

// Открыть окно. code — уже известный код (ссылка): сразу поиск и шаг 2. joined(campaignId, text) —
// что сделать после вступления (экран «Кампании» с сообщением)
export async function openJoinDialog({ code: linkCode = null, joined = () => {} } = {}) {
    wire();
    onJoined = joined;
    code = null;
    found = null;
    selected = null;
    busy = false;
    blocked = false;
    setError('join-code-error', '');
    setError('join-pick-error', '');
    byId('join-code-input').value = linkCode ?? '';
    setBusy(false);
    showStep('code');
    openSheet('join-sheet');
    if (linkCode === null) { byId('join-code-input').focus(); return; }
    await find(linkCode);
}

// При запуске страницы: код из ?join= убирается из адреса и запоминается до входа
export function takeJoinLink() {
    const url = new URL(location.href);
    if (!url.searchParams.has('join')) return;
    sessionStore.set(JOIN_KEY, url.searchParams.get('join') ?? '');
    url.searchParams.delete('join');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

// После входа и загрузки персонажей: отложенный код ссылки — шаг 2 поверх листа. Никто не открыт
// (персонажей нет) — после того, как персонаж будет создан или открыт
export function openPendingJoin(joined) {
    const raw = sessionStore.get(JOIN_KEY);
    if (raw === null) return;
    sessionStore.remove(JOIN_KEY);
    const pending = normalizeCode(raw);
    if (!isCodeShape(pending)) { showAlert(TEXT.badLink); return; }
    const open = () => openJoinDialog({ code: pending, joined });
    if (currentCharacterId() === null) afterCharacterOpened(open); else open();
}
