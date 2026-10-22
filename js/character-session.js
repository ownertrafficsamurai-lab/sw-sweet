import { state } from './state.js';
import { store } from './storage.js';
import { makeSaveQueue } from './save-queue.js';
import { SESSION_VERSION, checkSave, fixesMessage, sameSave } from './save-check.js';
import { listCharacters, loadCharacter, createCharacter, updateCharacter, deleteCharacter, currentUserId } from './character-store.js';
import { showSave, currentSession, saveReference, checkSaveText, characterFileText, downloadText, fileName, raceOf } from './persistence.js';
import { withRaceRanks } from './race-skills.js';
import { unsavedNotice } from './unsaved-notice.js';
import { NEW_KEY, importKey, needsCheck, afterFailedCreate, makePendingCreates } from './create-retry.js';
import { randomId } from './random-id.js';
import { showAlert, showDialog } from './ui-utils.js';
import { closeSheet } from './bottom-sheet.js';
import { openCharSetup, closeCharSetup, afterCharSetupClosed } from './char-setup-modal.js';
import { openCharacterList } from './character-list.js';
import { startTarget, displayName } from './character-list-model.js';
import { initNetStatus, isOffline } from './net-status.js';
import { hideLoading } from './loading-overlay.js';
import { answerLogout } from './logout-flow.js';
import { setDestinySheet } from './destiny-pool.js';

// Открытый персонаж и его запись в базу (подпроект 4б, спека
// 2026-10-02-character-in-database.md). Персонаж хранится в Supabase (character-store.js); на
// лист он попадает только через checkSave (save-check.js), в базу — тоже. Правки листа
// (saveSession в persistence.js) идут в очередь записи (save-queue.js): пауза 800 мс, одна запись
// за раз, проверка версии. В браузере — только пометки на аккаунт: кто открыт последним, ответ на
// вопрос о переносе и id переноса, ответ на который потерялся («Надёжная запись»).
const byId = id => document.getElementById(id);
// Сохранение прежних версий приложения (один персонаж на браузер): больше не пишется и не удаляется
const AUTOSAVE_KEY = 'swrpg_autosave_v1';
const TEXT = {
    failed: 'Не удалось сохранить',
    tooBig: 'Персонаж слишком большой — сократите заметки или тексты предметов',
    limit: 'Достигнут предел — 20 персонажей',
    create: 'Не удалось создать персонажа. Проверьте подключение к интернету.',
    load: 'Не удалось загрузить персонажа. Проверьте подключение к интернету.',
    unreadable: 'Персонажа не удалось прочитать',
    remove: 'Не удалось удалить персонажа. Проверьте подключение к интернету.',
    notCharacter: 'Это не файл персонажа',
    missing: 'Этого персонажа уже нет — возможно, он удалён на другом устройстве.',
};

let userId = null;
let currentId = null;   // id открытого персонажа; null — никто не открыт
let writeId = null;     // чей текст пишет очередь
let started = false;
// Что сделать, когда персонаж открыт (ссылка-приглашение пришла, пока персонажей не было, — 4.1)
let afterOpen = [];
// «+ Новый» с «Настройкой персонажа»: afterOpen — после её закрытия, а не поверх неё
let holdAfterOpen = false;
// Просмотр листа игрока мастером (4.2, party-view.js): { own } — свой персонаж в памяти ({ id,
// version, result } или null, если никто не был открыт); null — просмотра нет. Пока он идёт, очередь
// записи остановлена и queueSave молчит: на листе чужой персонаж
let viewing = null;

const lastKey = () => `swrpg_last_char_${userId}`;
const transferKey = () => `swrpg_transfer_${userId}`;
const transferIdKey = () => `swrpg_transfer_id_${userId}`;

// Неясные создания (create-retry.js): ответ на вставку не пришёл — повтор того же действия идёт с
// тем же id. В памяти вкладки; перенос — в localStorage: после перезагрузки вопрос о переносе
// задаётся раньше, чем виден список, и новый id дал бы копию
const pendingCreates = makePendingCreates();
const transferSlot = () => ({
    get: () => store.get(transferIdKey()),
    set: (id) => { store.set(transferIdKey(), id); },
    clear: () => { store.remove(transferIdKey()); },
});

// В базу уходит только проверенное: текст правки → checkSave → запись
// Записи без ответа (сеть оборвалась, таймаут): база могла их принять. Тогда следующая запись со
// старой версией не находит строки — это не другое устройство: в базе лежит одна из них
const UNCONFIRMED_MAX = 5;
let unconfirmed = [];
// Вид последнего сбоя записи ('too_big' | 'network') — для окна «правка не записана»
let failedError = null;
// Ответ открытого окна «не сохранено» (askUnsaved); null — окна нет
let answerUnsaved = null;

async function writeCharacter(text, version) {
    const id = writeId;
    const checked = checkSave(JSON.parse(text), saveReference());
    if (!checked.ok) return { error: 'network' };
    let result = await updateCharacter(id, version, checked.save);
    if (result.conflict && unconfirmed.length) {
        const loaded = await loadCharacter(id);
        if (loaded.ok && unconfirmed.some(save => sameSave(loaded.data, save))) result = await updateCharacter(id, loaded.version, checked.save);
    }
    if (id === writeId) unconfirmed = result.error === 'network' ? [checked.save, ...unconfirmed].slice(0, UNCONFIRMED_MAX) : [];
    return result;
}

function onQueueState(status, error) {
    // Без сети плашки нет: лист и так только для чтения, запись повторится, когда сеть вернётся
    const failed = status === 'failed' && !isOffline();
    if (status === 'failed') failedError = error;
    byId('save-failed').classList.toggle('hidden', !failed);
    if (failed) {
        byId('save-failed-text').textContent = error === 'too_big' ? TEXT.tooBig : TEXT.failed;
        // Слишком большой: повтор ничего не даст — «Повторить» нет
        byId('save-failed-retry').classList.toggle('hidden', error === 'too_big');
    }
    if (status === 'conflict') {
        // Фоновая запись (вкладка в фоне, вернулась сеть) получила расхождение, пока открыто окно
        // «не сохранено»: окно расхождения займёт его место — уход отменяется, а не ждёт ответа
        answerUnsaved?.(false);
        showConflict();
    }
}

// Свежая версия не загрузилась (нет сети) — окно возвращается: иначе очередь осталась бы в
// «расхождении» и молча отбрасывала правки
function showConflict() {
    showDialog({
        message: 'Персонаж изменён на другом устройстве.', note: 'Последнее изменение здесь не сохранено.',
        confirm: 'Загрузить свежую версию', sticky: true,
        onConfirm: async () => { if (!await showFromBase(currentId) && queue.state() === 'conflict') showConflict(); },
    });
}

const queue = makeSaveQueue({ write: writeCharacter, onState: onQueueState });

export function currentCharacterId() {
    return currentId;
}

// Правка листа (persistence.js saveSession): text — персонаж строкой JSON. В просмотре — ничего
export function queueSave(text) {
    if (viewing) return;
    queue.push(text);
}

// «Повторить» на плашке и возврат сети
export function retrySave() {
    return queue.flush();
}

// Окно «правка не записана» (unsaved-notice.js): текст и кнопки — по причине сбоя. Ответ
// обязателен (Esc окно не закрывает). → true — «Повторить», false — «Отмена» или «OK»
function askUnsaved(leave) {
    const notice = unsavedNotice({ error: failedError, offline: isOffline(), leave, name: displayName(byId('char-name').value) });
    return new Promise((done) => {
        answerUnsaved = (answer) => { answerUnsaved = null; done(answer); };
        showDialog({
            message: notice.message, note: notice.note, sticky: true,
            confirm: notice.retry ? 'Повторить' : 'OK', cancel: notice.retry ? 'Отмена' : null,
            onConfirm: () => answerUnsaved?.(notice.retry), onCancel: () => answerUnsaved?.(false),
        });
    });
}

// Несохранённое — записать сейчас. leave — куда уходит игрок ('switch' | 'logout', для текста
// окна). false — уходить с персонажа нельзя: запись не прошла (окно о причине) или персонаж изменён
// на другом устройстве (окно расхождения уже показала очередь). «Повторить» в окне — ещё одна
// запись: прошла — true, и действие продолжается само; нет — то же окно по новой причине
async function saved(leave = 'switch') {
    for (;;) {
        const status = await queue.flush();
        if (status === 'clean') return true;
        if (status !== 'failed' || !await askUnsaved(leave)) return false;
    }
}

// Очередь записи — на открытого персонажа с версией строки version. dirty — лист отличается от
// базы: записать сразу; иначе первая же перерисовка листа (она зовёт saveSession) записи не вызывает
function startQueue(version, dirty) {
    const text = JSON.stringify(currentSession());
    queue.start(version, dirty ? null : text);
    if (dirty) queue.push(text);
}

// Подпись в «Заметках» (4.2): персонаж в активной кампании — его заметки видит мастер. Там же —
// строка пула Судьбы этой кампании (этап 5, часть 2, destiny-pool.js). campaignId — id активной
// кампании открытого персонажа или null
function showCampaignNote(campaignId) {
    byId('notes-campaign-note').classList.toggle('hidden', !campaignId);
    setDestinySheet(campaignId && currentId ? { campaignId, characterId: currentId } : null);
}

// Экран «Кампании» загрузил свои кампании (my_campaigns) — подпись и пул по свежим данным
export function noteCampaigns(rows) {
    const row = rows.find(r => !r.deleted_at && (r.my_characters ?? []).some(c => c.id === currentId));
    showCampaignNote(row?.id ?? null);
}

// Проверенное сохранение (результат checkSave) — на лист; очередь записи — на этого персонажа.
// originalText — как персонаж выглядел до проверки (для «Сохранить исходную версию в файл»);
// campaign — его кампания (character-store.js loadCharacter) или null
function present(id, version, result, originalText, campaign = null) {
    queue.stop();
    closeSheet({ force: true });
    closeCharSetup();
    currentId = id;
    writeId = id;
    unconfirmed = [];
    // Этот персонаж уже есть — его «неясное» создание больше не повторяется
    pendingCreates.forget([id]);
    showCampaignNote(campaign?.active ? campaign.id : null);
    const granted = showSave(result);
    // Лист после проверки отличается от того, что лежит в базе, — записать сразу
    startQueue(version, granted || result.fixes.length > 0 || result.fromVersion < SESSION_VERSION);
    store.set(lastKey(), id);
    if (!holdAfterOpen) runAfterOpen();
    if (result.fixes.length) {
        showDialog({
            message: fixesMessage(result.fixes), confirm: 'OK',
            cancel: originalText ? 'Сохранить исходную версию в файл' : null, cancelKeepsOpen: true,
            onCancel: () => downloadText(fileName(result.save.charName, '_исходный'), originalText),
        });
    }
}

// Никто не открыт: лист пустой и не сохраняется, окно списка не закрывается, пока не выбран персонаж
function closeCharacter() {
    queue.stop();
    currentId = null;
    writeId = null;
    showCampaignNote(null);
    showSave(checkSave({ charName: '' }, saveReference()));
    state.isSaveReady = false;
    store.remove(lastKey());
    openCharacterList({ locked: true });
}

// Открыть персонажа из базы. true — открыт
export async function openCharacter(id) {
    return await saved() && showFromBase(id);
}

// Персонаж из базы — на лист, без записи открытого (openCharacter его уже записал; «Загрузить
// свежую версию» после расхождения записывать нечего). true — открыт
async function showFromBase(id) {
    const loaded = await loadCharacter(id);
    if (loaded.missing) {
        // Удалён на другом устройстве: открытый — лист очищается и открывается список; другой
        // (строка устаревшего списка) — сообщение и свежий список
        if (id === currentId || currentId === null) closeCharacter();
        else { showAlert(TEXT.missing); openCharacterList(); }
        return false;
    }
    if (!loaded.ok) { showAlert(TEXT.load); return false; }
    const result = checkSave(loaded.data, saveReference());
    if (!result.ok) { showAlert(TEXT.unreadable); return false; }
    present(id, loaded.version, result, JSON.stringify(loaded.data, null, 2), loaded.campaign);
    return true;
}

// ── Просмотр листа игрока (4.2) ── Очередь записи никогда не получает id чужого персонажа: на
// время просмотра она остановлена, после выхода снова пишет своего

export function isViewing() {
    return viewing !== null;
}

// Перед просмотром: свой персонаж дописывается и запоминается (id, версия, проверенное сохранение),
// очередь останавливается. false — не записался (сообщение уже показано), просмотра нет
export async function enterView() {
    if (viewing) return true;
    if (!await saved()) return false;
    const own = currentId === null ? null : { id: currentId, version: queue.version(), result: checkSave(currentSession(), saveReference()) };
    queue.stop();
    viewing = { own };
    return true;
}

// Лист игрока (результат checkSave) — на лист: без окна «В сохранении исправлено», без записи,
// без пометки «последний открытый» и без действий «после открытия персонажа»
export function showViewed(result) {
    closeSheet({ force: true });
    closeCharSetup();
    showSave(result);
}

// Выход из просмотра: свой персонаж — из памяти (без запроса), очередь снова на него с его версией.
// false — своего открыто не было: пустой лист и запертое окно «Персонажи», как без просмотра
export function leaveView() {
    if (!viewing) return true;
    const { own } = viewing;
    viewing = null;
    if (!own) { closeCharacter(); return false; }
    // За время просмотра открыт другой свой персонаж (его очередь уже идёт): память о прежнем на
    // него не кладётся и очередь не перезапускается
    if (own.id !== currentId) return true;
    closeSheet({ force: true });
    closeCharSetup();
    showSave(own.result);
    startQueue(own.version, false);
    return true;
}

// Новая строка в базе из проверенного сохранения (новый персонаж, импорт, перенос). true — создан и
// открыт. Сохранение до версии 6 получает расовые ранги до записи: строка сразу создаётся с ними.
// slot — где помнится id неясного создания этого действия ({ get, set, clear }, create-retry.js):
// повтор идёт с тем же id и отправляет то же сохранение. Ответ не пришёл, «такой id уже есть» или
// предел при повторе — строка ищется по id: нашлась — открывается, как созданная. onLimit — вместо
// сообщения о пределе 20 (перенос из браузера)
async function addCharacter(result, originalText, slot, onLimit = null) {
    if (!await saved()) return false;
    const ready = withRaceRanks(result, raceOf(result.save));
    const retry = slot.get() !== null;
    const id = slot.get() ?? randomId();
    const created = await createCharacter(id, ready.save);
    if (created.ok) {
        slot.clear();
        present(id, created.version, ready, originalText);
        return true;
    }
    const found = needsCheck(created.error, retry) ? await loadCharacter(id) : null;
    const next = afterFailedCreate(created.error, found, retry);
    if (next.open) return presentFound(id, found, ready, originalText, slot);
    if (next.keep) slot.set(id); else slot.clear();
    if (next.message === 'limit' && onLimit) onLimit();
    else showAlert(TEXT[next.message]);
    return false;
}

// Строка нашлась по id (вставка прошла, а ответ потерялся): открывается такой, какая она в базе, —
// между попытками её могли открыть из списка и править. Окно «В сохранении исправлено» — как у
// созданной (fixes исходного сохранения)
function presentFound(id, found, ready, originalText, slot) {
    slot.clear();
    const result = checkSave(found.data, saveReference());
    if (!result.ok) { showAlert(TEXT.unreadable); return false; }
    present(id, found.version, { ...result, fixes: ready.fixes }, originalText, found.campaign);
    return true;
}

// Окно «Персонажи» загрузило список: эти персонажи уже есть — их «неясные» создания не повторяются
export function listedCharacters(rows) {
    pendingCreates.forget(rows.map(row => row.id));
}

// «+ Новый»: значения по умолчанию и «Настройка персонажа». setup: false — без «Настройки»
// (вступление новым персонажем, 4.1)
export async function newCharacter({ setup = true } = {}) {
    holdAfterOpen = setup;
    try {
        if (!await addCharacter(checkSave({ charName: '' }, saveReference()), null, pendingCreates.slot(NEW_KEY))) return false;
    } finally {
        holdAfterOpen = false;
    }
    if (setup) {
        openCharSetup();
        if (afterOpen.length) afterCharSetupClosed(runAfterOpen);
    }
    return true;
}

function runAfterOpen() {
    for (const callback of afterOpen.splice(0)) callback();
}

// callback — один раз, когда персонаж будет открыт (открыт, создан, загружен или перенесён)
export function afterCharacterOpened(callback) {
    afterOpen.push(callback);
}

// «Импорт из файла»: всегда новый персонаж; «не тот» файл отклоняется до записи
export async function importCharacter(file) {
    let text;
    try { text = await file.text(); } catch { text = ''; }
    const result = checkSaveText(text);
    if (!result.ok) { showAlert(TEXT.notCharacter); return false; }
    return addCharacter(result, text, pendingCreates.slot(importKey(text)));
}

// «Удалить» (после подтверждения в окне списка). true — удалён. Открытый удаляется без записи
// последней правки — она уходит вместе с ним (мелочи 4б); очередь останавливается сразу:
// недописанное не должно записаться в строку, которой уже нет
export async function removeCharacter(id) {
    const open = id === currentId;
    const version = queue.version();
    const dirty = queue.state() !== 'clean';
    if (open) queue.stop();
    const removed = await deleteCharacter(id);
    if (!removed.ok) {
        // Удаление не прошло — персонаж остаётся открытым, незаписанная правка снова в очереди
        if (open) startQueue(version, dirty);
        showAlert(TEXT.remove);
        return false;
    }
    if (open) closeCharacter();
    return true;
}

// «Сохранить в файл» из окна списка: персонаж читается из базы и проходит ту же проверку
export async function characterFile(id) {
    // Открытый — с листа: в файл попадает и правка, которая ещё не записана
    if (id === currentId) {
        downloadText(fileName(byId('char-name').value), characterFileText());
        return true;
    }
    const loaded = await loadCharacter(id);
    const result = loaded.ok ? checkSave(loaded.data, saveReference()) : { ok: false };
    if (!result.ok) { showAlert(loaded.ok || loaded.missing ? TEXT.unreadable : TEXT.load); return false; }
    downloadText(fileName(result.save.charName), JSON.stringify(result.save, null, 2));
    return true;
}

// Ответ на вопрос о переносе запоминается вместе с забвением id переноса
function answerTransfer(answer) {
    store.set(transferKey(), answer);
    store.remove(transferIdKey());
}

// Персонаж из браузера (прежние версии приложения) — вопрос один раз на аккаунт в этом браузере.
// → null или, если «Перенести» упёрлось в предел 20, перенос для окна «Персонажи»
// (character-list.js): { name, move() → Promise<true — перенесён и открыт>, decline() }
function offerTransfer() {
    if (store.get(transferKey())) return Promise.resolve(null);
    const text = store.get(AUTOSAVE_KEY);
    if (!text) return Promise.resolve(null);
    const result = checkSaveText(text);
    if (!result.ok) { answerTransfer('no'); return Promise.resolve(null); }
    hideLoading();
    const offer = {
        name: displayName(result.save.charName),
        move: async () => {
            if (!await addCharacter(result, text, transferSlot())) return false;
            answerTransfer('yes');
            return true;
        },
        decline: () => answerTransfer('no'),
    };
    return new Promise((done) => showDialog({
        message: `В этом браузере найден персонаж «${offer.name}». Перенести его в ваш аккаунт?`,
        note: 'Копия в браузере останется как запасная.',
        confirm: 'Перенести', cancel: 'Не переносить', sticky: true,
        onCancel: () => { offer.decline(); done(null); },
        // Нет сети — ответ не запоминается, вопрос будет задан при следующем запуске (с тем же id
        // переноса); предел — окно «Персонажи» с подсказкой
        onConfirm: async () => {
            let full = false;
            if (await addCharacter(result, text, transferSlot(), () => { full = true; })) answerTransfer('yes');
            done(full ? offer : null);
        },
    }));
}

function wireOnce() {
    if (started) return;
    started = true;
    // Сеть вернулась — дописать то, что не успело записаться
    initNetStatus(() => { queue.flush(); });
    byId('save-failed-retry').addEventListener('click', () => { queue.flush(); });
    // Другая вкладка выходит из аккаунта: дописать очередь и ответить, записано ли («Надёжная
    // запись», п. 3). Никто не открыт и просмотр листа игрока — очередь пуста, «записано» сразу. Это
    // обычный flush (как «Повторить» на плашке): прошёл — плашка исчезает; новых окон нет
    answerLogout(async () => await queue.flush() === 'clean', () => displayName(byId('char-name').value));
    // Вкладка уходит в фон или закрывается: несохранённое отправляется сразу. Браузер не обещает
    // довести запрос до конца при закрытии — поэтому ещё и предупреждение
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') queue.flush(); });
    window.addEventListener('pagehide', () => { queue.flush(); });
    window.addEventListener('beforeunload', (e) => {
        if (queue.state() === 'clean' || queue.state() === 'conflict') return;
        e.preventDefault();
        e.returnValue = '';
    });
}

// Запуск после входа и загрузки справочников: перенос из браузера (если нужен), затем последний
// открытый персонаж; его нет — окно списка. → { ok: true } | { error } — список не загрузился
export async function startCharacters() {
    userId = await currentUserId();
    wireOnce();
    const listed = await listCharacters();
    if (!listed.ok) return { error: listed.error };
    const transfer = await offerTransfer();
    if (currentId === null) {
        const target = startTarget(listed.rows, store.get(lastKey()));
        if (!target || !await openCharacter(target)) {
            if (currentId === null) closeCharacter();
        }
    }
    // Перенос упёрся в предел — окно «Персонажи» с подсказкой поверх открытого персонажа
    if (transfer) openCharacterList({ locked: currentId === null, transfer });
    hideLoading();
    return { ok: true };
}

// «Выйти»: сначала дописать несохранённое. false — не записалось (окно уже показано)
export function beforeLogout() {
    return saved('logout');
}
