// Service worker релиза v2: все файлы приложения лежат в телефоне (APP_FILES), свои файлы — «сеть первой,
// кэш — без сети», запросы к Supabase и не-GET не перехватываются. Без сети открывается index.html из кэша,
// и приложение показывает «Нет сети». Версия кэша в репозитории — swrpg-dev; scripts/publish.mjs ставит
// swrpg-<отпечаток содержимого>, поэтому любой релиз меняет байты sw.js и браузер ставит новый SW сам.
const CACHE_NAME = 'swrpg-e03d934575ab';

// Список ведётся руками; scripts/tests/app-files.test.mjs и scripts/publish.mjs сверяют его с файлами app/
// APP_FILES:begin
const APP_FILES = [
    "./css/fonts.css",
    "./css/style.css",
    "./css/themes.css",
    "./icon-192.png",
    "./icon-512.png",
    "./icons/ability.svg",
    "./icons/advantage.svg",
    "./icons/boost.svg",
    "./icons/challenge.svg",
    "./icons/dark.svg",
    "./icons/despair.svg",
    "./icons/difficulty.svg",
    "./icons/failure.svg",
    "./icons/force.svg",
    "./icons/light.svg",
    "./icons/prof.svg",
    "./icons/setback.svg",
    "./icons/success.svg",
    "./icons/threat.svg",
    "./icons/triumph.svg",
    "./index.html",
    "./js/abilities-tab.js",
    "./js/abilities.js",
    "./js/auth-gate.js",
    "./js/auth.js",
    "./js/avatar.js",
    "./js/bottom-sheet.js",
    "./js/campaign-store.js",
    "./js/campaigns-model.js",
    "./js/campaigns-screen.js",
    "./js/catalog-picker.js",
    "./js/char-setup-modal.js",
    "./js/character-generator.js",
    "./js/character-list-model.js",
    "./js/character-list.js",
    "./js/character-session.js",
    "./js/character-store.js",
    "./js/choice-model.js",
    "./js/choice-picker.js",
    "./js/condition-panel.js",
    "./js/create-retry.js",
    "./js/destiny-model.js",
    "./js/destiny-pool.js",
    "./js/force-panel.js",
    "./js/hud-card.js",
    "./js/hud-collapse.js",
    "./js/hud-math.js",
    "./js/hud-place.js",
    "./js/inventory-equipment.js",
    "./js/inventory.js",
    "./js/item-icons.js",
    "./js/join-dialog.js",
    "./js/loading-overlay.js",
    "./js/logout-flow.js",
    "./js/logout-poll.js",
    "./js/main.js",
    "./js/net-status.js",
    "./js/obligations.js",
    "./js/party-live.js",
    "./js/party-model.js",
    "./js/party-sheets.js",
    "./js/party-view.js",
    "./js/persistence.js",
    "./js/pull-refresh.js",
    "./js/race-change.js",
    "./js/race-skill-picker.js",
    "./js/race-skills.js",
    "./js/random-id.js",
    "./js/reference-data.js",
    "./js/reference-shape.js",
    "./js/save-check.js",
    "./js/save-queue.js",
    "./js/sheet-stats.js",
    "./js/skill-discount.js",
    "./js/skills.js",
    "./js/spec-change.js",
    "./js/stat-info.js",
    "./js/stat-panel.js",
    "./js/state.js",
    "./js/storage.js",
    "./js/supabase-client.js",
    "./js/tailwind-config.js",
    "./js/talent-graph.js",
    "./js/talent-tree.js",
    "./js/text-size.js",
    "./js/theme-list.js",
    "./js/theme.js",
    "./js/tree-preview.js",
    "./js/ui-utils.js",
    "./js/unsaved-notice.js",
    "./js/xp-history.js",
    "./js/xp-panel.js",
    "./js/xp.js",
    "./manifest.json",
    "./vendor/fonts/rajdhani-400-latin-ext.woff2",
    "./vendor/fonts/rajdhani-400-latin.woff2",
    "./vendor/fonts/rajdhani-500-latin-ext.woff2",
    "./vendor/fonts/rajdhani-500-latin.woff2",
    "./vendor/fonts/rajdhani-600-latin-ext.woff2",
    "./vendor/fonts/rajdhani-600-latin.woff2",
    "./vendor/fonts/rajdhani-700-latin-ext.woff2",
    "./vendor/fonts/rajdhani-700-latin.woff2",
    "./vendor/fonts/share-tech-mono-400-latin.woff2",
    "./vendor/supabase-js-2.118.0.js",
    "./vendor/tailwind-3.4.17.js"
];
// APP_FILES:end

// Папка приложения (…/sw-sweet/) — перехватываются только её адреса
const SCOPE = new URL('./', self.location).href;
const INDEX = new URL('./index.html', self.location).href;

// cache: 'no-cache' — мимо HTTP-кэша: GitHub Pages отдаёт max-age=600, иначе свежий релиз доходил бы до 10 минут
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES.map(file => new Request(new URL(file, SCOPE).href, { cache: 'no-cache' }))))
            .then(() => self.skipWaiting())
    );
});

// Старые кэши — прежних релизов и swrpg-v3 старого MVP (он отдавал index.html «кэш первым») — удаляются
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;
    const navigation = request.mode === 'navigate';
    // Переход по странице (в т. ч. …/?join=КОД) — это index.html: в кэше он один, под своим адресом
    const key = navigation ? INDEX : request;
    event.respondWith((async () => {
        try {
            // Навигационный запрос нельзя пересоздать с RequestInit — только новый запрос по адресу
            const response = navigation
                ? await fetch(new Request(request.url, { cache: 'no-cache' }))
                : await fetch(request, { cache: 'no-cache' });
            if (response.ok) {
                const copy = response.clone();
                event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(key, copy)));
            }
            return response;
        } catch (err) {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(key);
            if (cached) return cached;
            throw err;
        }
    })());
});
