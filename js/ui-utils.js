import { initTalentTree } from './talent-tree.js';
import { renderAbilities } from './abilities-tab.js';
import { updateGeneratorUI } from './character-generator.js';
import { closeShade } from './hud-collapse.js';
import { placeHudCard } from './hud-place.js';
import { showInventoryTab } from './inventory-equipment.js';
import { store } from './storage.js';

// === СЛОВАРЬ ИКОНОК ===
const ICONS = {
    // Кубики
    "\\[BO\\]": "boost.svg",      // [BO]ost
    "\\[SE\\]": "setback.svg",    // [SE]tback
    "\\[AB\\]": "ability.svg",    // [AB]ility
    "\\[DI\\]": "difficulty.svg", // [DI]fficulty
    "\\[PR\\]": "prof.svg",       // [PR]oficiency
    "\\[CH\\]": "challenge.svg",  // [CH]allenge
    "\\[FO\\]": "force.svg",      // [FO]rce die

    // Результаты
    "\\[SU\\]": "success.svg",    // [SU]ccess
    "\\[AD\\]": "advantage.svg",  // [AD]vantage
    "\\[TR\\]": "triumph.svg",    // [TR]iumph
    "\\[FA\\]": "failure.svg",    // [FA]ilure
    "\\[TH\\]": "threat.svg",     // [TH]reat
    "\\[DE\\]": "despair.svg",    // [DE]spair
    "\\[LS\\]": "light.svg",      // [L]ight [S]ide
    "\\[DS\\]": "dark.svg"        // [D]ark [S]ide
};

// Функция для замены кодов на картинки
export function formatDesc(text) {
    if (!text) return "";
    let formatted = text;

    // Проходим по словарю и заменяем все совпадения
    for (const [key, filename] of Object.entries(ICONS)) {
        // Создаем регулярное выражение для глобальной замены
        const regex = new RegExp(key, "g");
        const imgTag = `<img src="icons/${filename}" class="dice-icon" alt="${key}">`;
        formatted = formatted.replace(regex, imgTag);
    }
    return formatted;
}

// === ВКЛАДКИ ===
// Пять разделов (подпроект А2): на компьютере — вкладки в верхней строке (#btn-*), на телефоне —
// нижняя панель (#nav-*); активный пункт подсвечивается в обоих местах
const TABS = ['generator', 'abilities', 'talents', 'equipment', 'notes'];

export function switchTab(tab) {
    TABS.forEach(t => {
        const active = t === tab;
        document.getElementById('tab-' + t)?.classList.toggle('hidden', !active);
        const top = document.getElementById('btn-' + t);
        if (top) top.className = 'sw-tab-btn' + (active ? ' active' : '');
        const nav = document.getElementById('nav-' + t);
        if (nav) {
            nav.classList.toggle('active', active);
            if (active) nav.setAttribute('aria-current', 'page'); else nav.removeAttribute('aria-current');
        }
    });

    // Переход на другую вкладку закрывает шторку карточки (телефон, hud-collapse.js)
    closeShade();
    // Карточка — в боковую панель «Листа» / «Способностей» или в шапку (hud-place.js)
    placeHudCard(tab);

    if (tab === 'talents') initTalentTree();
    if (tab === 'generator') updateGeneratorUI();
    if (tab === 'abilities') renderAbilities();
    // «Снаряжение»: строки свёрнуты, урон и пул — по текущим характеристикам и рангам
    if (tab === 'equipment') showInventoryTab();
}

// === МОДАЛЬНЫЕ ДИАЛОГИ ===
// Одно окно #modal-overlay на всё приложение. message — главный текст, note — пояснение мельче
// (оба только textContent); confirm / cancel — подписи кнопок (cancel: null — кнопки нет); danger —
// красная кнопка подтверждения; sticky — Esc окно не закрывает (ответ обязателен);
// cancelKeepsOpen — вторая кнопка выполняет onCancel, а окно остаётся открытым
const CONFIRM_CLASS = 'px-4 py-2 rounded fs-body font-bold transition active:scale-95 ';
const CONFIRM_LOOK = { normal: 'bg-yellow-600 hover:bg-yellow-500 text-on-accent', danger: 'bg-red-700 hover:bg-red-600 text-white' };

export function showDialog({ message, note = '', confirm = 'OK', cancel = null, danger = false, sticky = false, cancelKeepsOpen = false, onConfirm, onCancel }) {
    const byId = id => document.getElementById(id);
    const overlay = byId('modal-overlay');
    const yes = byId('modal-confirm-btn');
    const no = byId('modal-cancel-btn');
    byId('modal-message').textContent = message;
    byId('modal-note').textContent = note;
    byId('modal-note').classList.toggle('hidden', !note);
    yes.textContent = confirm;
    yes.className = CONFIRM_CLASS + (danger ? CONFIRM_LOOK.danger : CONFIRM_LOOK.normal);
    no.classList.toggle('hidden', cancel === null);
    if (cancel !== null) no.textContent = cancel;
    if (sticky) overlay.dataset.sticky = '1'; else delete overlay.dataset.sticky;
    const close = () => { overlay.classList.add('hidden'); delete overlay.dataset.sticky; };
    yes.onclick = () => { close(); onConfirm?.(); };
    no.onclick = () => { if (!cancelKeepsOpen) close(); onCancel?.(); };
    overlay.classList.remove('hidden');
}

export function showAlert(msg, cb) {
    showDialog({ message: msg, onConfirm: cb });
}

export function showConfirm(msg, onYes, onNo) {
    showDialog({ message: msg, confirm: 'Да', cancel: 'Отмена', onConfirm: onYes, onCancel: onNo });
}

// === TOAST NOTIFICATIONS ===
const TOAST_COLORS = {
    success: 'border-green-500/40 text-green-400 bg-green-950/80',
    gold:    'border-yellow-500/40 text-yellow-300 bg-yellow-950/80',
    info:    'border-blue-500/40 text-blue-300 bg-blue-950/80',
    error:   'border-red-500/40 text-red-400 bg-red-950/80',
};

function toastElement(msg, type) {
    const container = document.getElementById('toast-container');
    if (!container) return null;
    const el = document.createElement('div');
    el.className = `sw-toast flex items-center gap-2 px-3 py-2 rounded border backdrop-blur-sm fs-small shadow-lg ${TOAST_COLORS[type] || TOAST_COLORS.gold}`;
    el.textContent = msg;
    container.appendChild(el);
    return el;
}

// Надпись на время ожидания (вид уведомления «info»): держится, пока её не уберут. → убрать её
export function showStatus(msg) {
    const el = toastElement(msg, 'info');
    if (!el) return () => {};
    el.setAttribute('role', 'status');
    return () => el.remove();
}

export function showToast(msg, type) {
    const el = toastElement(msg, type);
    if (!el) return;
    setTimeout(() => {
        el.classList.add('hiding');
        el.addEventListener('animationend', () => el.remove());
    }, 2500);
}

// === COLLAPSIBLE SECTIONS ===
// Разделы «Листа» и «Способностей»: заголовок .section-divider сворачивает следующий за ним блок.
// Состояние — в localStorage (sw_sections), ключ — первые 12 букв заголовка (цифры счётчиков в
// него не входят). Заголовок — кнопка для клавиатуры и экранных читалок (Tab, Enter / Space,
// aria-expanded); свёрнутый блок inert — фокус в него не заходит.
// Хранилище может быть недоступно, а значение — испорчено: тогда все разделы раскрыты
function readSectionStates() {
    try {
        const saved = JSON.parse(store.get('sw_sections') || '{}');
        return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch { return {}; }
}
const sectionStates = readSectionStates();

export function initCollapsibleSections() {
    document.querySelectorAll('#tab-generator .section-divider, #tab-abilities .section-divider').forEach(divider => {
        const titleSpan = divider.querySelector('.section-title');
        if (!titleSpan) return;
        const content = divider.nextElementSibling;
        if (!content) return;
        const rawKey = titleSpan.textContent.trim().replace(/[^а-яА-ЯёЁa-zA-Z]/g, '').slice(0, 12);
        if (!rawKey) return;

        // Wrap content for animation
        content.classList.add('sw-section-body');

        // Chevron
        const chev = document.createElement('span');
        chev.className = 'sw-section-chevron';
        chev.setAttribute('aria-hidden', 'true');
        chev.textContent = '▶';
        titleSpan.prepend(chev);

        const show = (collapsed) => {
            content.classList.toggle('sw-collapsed', collapsed);
            content.inert = collapsed;
            chev.classList.toggle('collapsed', collapsed);
            divider.setAttribute('aria-expanded', String(!collapsed));
        };
        // Restore state
        show(!!sectionStates[rawKey]);

        divider.classList.add('sw-collapsible');
        divider.setAttribute('role', 'button');
        divider.tabIndex = 0;
        const toggle = () => {
            const collapsed = !content.classList.contains('sw-collapsed');
            show(collapsed);
            sectionStates[rawKey] = collapsed;
            store.set('sw_sections', JSON.stringify(sectionStates));
        };
        divider.onclick = toggle;
        divider.onkeydown = (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault(); // Space не прокручивает страницу
            toggle();
        };
    });
}

// === SKILL FILTER ===
export function filterSkills(query) {
    const q = (query || '').toLowerCase().trim();
    ['gen-skills-general-body', 'gen-skills-knowledge-body', 'gen-skills-combat-body'].forEach(id => {
        const tbody = document.getElementById(id);
        if (!tbody) return;
        tbody.querySelectorAll('tr[data-skill]').forEach(tr => {
            tr.style.display = (!q || tr.dataset.skill.includes(q)) ? '' : 'none';
        });
    });
}
