const CACHE_NAME = 'noir-pos-cache-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok && (event.request.mode === 'navigate' || url.pathname.startsWith('/assets/') || url.pathname === '/manifest.webmanifest')) {
        const cacheKey = event.request.mode === 'navigate' ? '/index.html' : event.request;
        caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, response.clone()));
      }
      return response;
    }).catch(() => caches.match(event.request.mode === 'navigate' ? '/index.html' : event.request))
  );
});
