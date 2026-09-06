/**
 * service-worker.js
 * Caches the static app shell (HTML/CSS/JS/icons) so Next Step opens
 * instantly and still loads with no signal. It does NOT cache API calls —
 * every google.script.run request always goes to the network, since
 * schedule data must stay live.
 */
const CACHE_NAME = 'next-step-shell-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './gas-client.js',
  './time-picker.js',
  './app.js',
  './calendar.js',
  './availability.js',
  './modal.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle our own GET requests for the app shell. Everything that
  // goes to the Apps Script backend (script.google.com) — or any POST —
  // is left alone so schedule data is always fresh.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached); // offline fallback to cache
      return cached || network;
    })
  );
});
