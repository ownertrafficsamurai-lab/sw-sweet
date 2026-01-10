const CACHE_NAME = 'swrpg-v3'; // Смените версию на v3, чтобы обновить кэш у старых юзеров
const urlsToCache = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './tailwind.js' // Теперь грузим локально
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
// Добавьте очистку старого кэша, чтобы старые пользователи получили обновление
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});