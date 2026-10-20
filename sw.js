/* Service worker prototipe: hanya app shell + halaman offline. Data pajak TIDAK di-cache (aturan R11). */
const CACHE = 'gispajak-shell-v3';
const SHELL = ['./', './index.html', './offline.html', './assets/css/tokens.css', './assets/css/components.css', './assets/css/layout.css', './assets/css/app.css', './assets/img/icon.svg', './assets/img/icon-192.png', './assets/img/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).catch(() => caches.match('./offline.html'))); return; }
  const url = new URL(e.request.url);
  if (url.origin === location.origin && SHELL.some(p => url.pathname.endsWith(p.replace('./', '/')))) e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
