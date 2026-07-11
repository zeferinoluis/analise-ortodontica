const CACHE_NAME = 'ortoanalytic-cache-v11-1';

// Assets locais — obrigatórios para a instalação offline
const ASSETS_LOCAIS = [
  './',
  'index.html',
  'recovery.html',
  'styles.css',
  'utils.js',
  'state.js',
  'database.js',
  'undo-redo.js',
  'canvas-editor.js',
  'cephalometry.js',
  'facial.js',
  'models.js',
  'interpretacao-clinica.js',
  'ui.js',
  'exportacao-pdf.js',
  'google-drive.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

// Assets externos (CDN) — em best-effort: se falharem, a instalação não é bloqueada
const ASSETS_EXTERNOS = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Externos: cada um individualmente, sem bloquear a instalação se o CDN falhar
      ASSETS_EXTERNOS.forEach((url) => {
        cache.add(url).catch(() => console.warn('OrtoAnalytic PWA: CDN indisponível na instalação:', url));
      });
      // Locais: obrigatórios
      return cache.addAll(ASSETS_LOCAIS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('OrtoAnalytic PWA: A remover cache antiga:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estratégia híbrida:
// - App shell (HTML, app.js, styles.css, manifest): network-first — atualizações chegam
//   aos utilizadores logo que publicadas, com fallback à cache quando offline.
// - Restantes (ícones, CDN, imagens): cache-first — rápido e estável.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Nunca intercetar a API do Google Drive nem a autenticação — têm de ir sempre
  // à rede (a estratégia cache-first devolveria listagens/backups obsoletos).
  if (url.hostname.endsWith('googleapis.com') || url.hostname === 'accounts.google.com') return;

  const ehAppShell =
    event.request.mode === 'navigate' ||
    (url.origin === self.location.origin && /\/(index\.html)?$|\/[^/]+\.js$|styles\.css$|manifest\.json$/.test(url.pathname));

  if (ehAppShell) {
    // NETWORK-FIRST
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => {
          return cached || new Response("Recurso indisponível offline.", {
            status: 503,
            statusText: "Service Unavailable",
            headers: new Headers({ "Content-Type": "text/plain; charset=utf-8" })
          });
        }))
    );
    return;
  }

  // CACHE-FIRST para o resto
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return new Response("Recurso indisponível offline.", {
            status: 503,
            statusText: "Service Unavailable",
            headers: new Headers({ "Content-Type": "text/plain; charset=utf-8" })
          });
        });
    })
  );
});
