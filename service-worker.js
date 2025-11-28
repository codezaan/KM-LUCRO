self.addEventListener('install', evt => {
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  clients.claim();
});

self.addEventListener('fetch', evt => {
  // comportamento simples: tenta rede (fetch) — evita problema de rota no Pages
  evt.respondWith(fetch(evt.request));
});

