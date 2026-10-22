// Экран загрузки справочников. Разметка #app-loading видна сразу при открытии страницы
// (лежит под экраном входа) и скрывается после успешной загрузки.
const MESSAGES = {
    network: 'Не удалось загрузить справочники. Проверьте подключение к интернету.',
    characters: 'Не удалось загрузить список персонажей. Проверьте подключение к интернету.',
    empty: 'Справочники не загрузились — возможно, истекла сессия.',
    offline: 'Нет сети — персонаж откроется, когда появится связь.',
};

const byId = id => document.getElementById(id);

// Без сети (релиз v2) любая неудачная загрузка при запуске — «Нет сети», а не «проверьте подключение»
export function loadErrorKind(kind, online) {
    return online === false ? 'offline' : kind;
}

// «Нет сети»: вернувшаяся сеть сама нажимает «Повторить» — один раз; снимается при любой смене экрана,
// иначе обрыв и возврат сети посреди игры перезапустили бы приложение
let onlineRetry = null;
function dropOnlineRetry() {
    if (onlineRetry) window.removeEventListener('online', onlineRetry);
    onlineRetry = null;
}

export function showLoading(text = 'Загрузка справочников…') {
    dropOnlineRetry();
    // После деплоя установленное PWA может отдать старый закэшированный index.html
    // (без разметки #app-loading) вместе с новым main.js — тогда молча выходим.
    if (!byId('app-loading')) return;
    byId('app-loading').classList.remove('hidden');
    byId('app-loading-spinner').classList.remove('hidden');
    byId('app-loading-message').textContent = text;
    byId('app-loading-actions').classList.add('hidden');
}

export function hideLoading() {
    dropOnlineRetry();
    if (!byId('app-loading')) return;
    byId('app-loading').classList.add('hidden');
}

export function showLoadError(kind, { onRetry, onLogout }) {
    dropOnlineRetry();
    if (!byId('app-loading-spinner')) {
        // Разметки нет (старый закэшированный index.html) — хотя бы alert, чтобы
        // пользователь не остался с пустым листом без объяснения
        alert(MESSAGES[kind] || MESSAGES.network);
        return;
    }
    byId('app-loading-spinner').classList.add('hidden');
    byId('app-loading-message').textContent = MESSAGES[kind] || MESSAGES.network;
    byId('app-loading-actions').classList.remove('hidden');
    const retry = byId('app-loading-retry');
    retry.disabled = false;
    // Блокируем кнопку до следующей попытки, чтобы двойной клик не запустил загрузку дважды
    retry.onclick = () => { dropOnlineRetry(); retry.disabled = true; onRetry(); };
    if (kind === 'offline') {
        onlineRetry = () => retry.onclick();
        window.addEventListener('online', onlineRetry);
    }
    const logoutBtn = byId('app-loading-logout');
    logoutBtn.classList.toggle('hidden', kind !== 'empty');
    logoutBtn.onclick = onLogout;
}
