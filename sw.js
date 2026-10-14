/* Service worker: сайт открывается как приложение и работает без сети.
   Сначала сеть (чтобы твои правки сразу появлялись), если сети нет — кэш. */
const CACHE = 'server-site-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest',
  'css/base.css', 'css/components.css', 'css/pages.css',
  'js/data.js', 'js/store.js', 'js/ui.js', 'js/auth.js', 'js/analytics.js', 'js/pages.js', 'js/chat.js', 'js/admin.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // головы игроков, API онлайна — мимо кэша
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
