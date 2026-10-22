import { askOtherTabs, answerAsks, otherTabsNotice, WAIT_TEXT } from './logout-poll.js';
import { showDialog, showStatus } from './ui-utils.js';
import { logout } from './auth-gate.js';
import { randomId } from './random-id.js';

// «Выйти» с договорённостью вкладок («Надёжная запись», п. 3; правила — logout-poll.js). Без
// BroadcastChannel (старые браузеры) — выход, как раньше, без вопроса
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('swrpg-logout') : null;
const tab = randomId();
let leaving = false;

// Эта вкладка отвечает на вопросы других (character-session.js, после входа)
export function answerLogout(flush, name) {
    if (channel) answerAsks({ channel, tab, flush, name });
}

// Имена персонажей в вкладках, которые не записали; ожидание дольше SLOW_MS — надпись
async function otherTabsUnsaved() {
    if (!channel) return [];
    let hide = null;
    try {
        return await askOtherTabs({ channel, ask: randomId(), onSlow: () => { hide = showStatus(WAIT_TEXT); } });
    } finally {
        hide?.();
    }
}

// «Выйти». own() → Promise<boolean> — дописать правку этой вкладки (character-session.js
// beforeLogout: окна «не сохранено» — его); на экране загрузки своей правки нет. Затем остальные
// вкладки: все записали — выход; нет — окно «Отмена» / «Выйти всё равно» (Esc — как «Отмена»).
// Перед самим выходом своя очередь дописывается ещё раз: правка, сделанная, пока ждали вкладки
export async function logoutWithTabs(own = async () => true) {
    if (leaving) return;
    leaving = true;
    try {
        if (!await own()) return;
        const names = await otherTabsUnsaved();
        if (!names.length) {
            if (await own()) logout();
            return;
        }
        const notice = otherTabsNotice(names);
        showDialog({
            message: notice.message, note: notice.note,
            cancel: 'Отмена', confirm: 'Выйти всё равно', danger: true,
            onConfirm: async () => { if (await own()) logout(); },
        });
    } finally {
        leaving = false;
    }
}
