// Nome da versão do cache
const CACHE_NAME = "km-lucro-v1";

// Arquivos que devem ser armazenados para funcionar offline
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",

  // Ícones
  "./imagens/icon-192.png",
  "./imagens/icon-512.png",

  // Logo principal
  "./imagens/logo.png",
];

// INSTALAÇÃO — faz cache dos arquivos
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );

  // Força ativar imediatamente
  self.skipWaiting();
});

// ATIVAÇÃO — remove caches antigos
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

// INTERCEPTA REQUISIÇÕES
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cacheRes => {
      // Se existir no cache -> entrega
      // Se não -> baixa da internet
      return cacheRes || fetch(event.request);
    })
  );
});
