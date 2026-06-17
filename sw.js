const CACHE_NAME = 'timer-round-v2';

self.addEventListener('install', event => {
  self.skipWaiting(); // Fuerza la instalación inmediata del nuevo Service Worker
});

self.addEventListener('activate', event => {
  // Borra cualquier caché antigua (v1) para evitar que la app quede congelada en una versión rota
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Borrando caché antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim(); // Toma el control de la página inmediatamente
});

self.addEventListener('fetch', event => {
  // Estrategia "Network First": Siempre intenta buscar la versión más nueva en internet.
  // Solo si no hay internet (falla el fetch), busca en la caché.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
