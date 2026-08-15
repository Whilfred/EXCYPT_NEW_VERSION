const CACHE_NAME = 'excrypt-static-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',

  './css/style.css',
  './css/auth.css',
  './css/dashboard.css',
  './css/trade.css',

  './js/api.js',
  './js/auth.js',
  './js/auth-guard.js',
  './js/buy.js',
  './js/countries.js',
  './js/dashboard.js',
  './js/pwa.js',
  './js/rates.js',
  './js/sebpay.js',

  './pages/acheter.html',
  './pages/convert.html',
  './pages/dashboard.html',
  './pages/deposit.html',
  './pages/forgot-password.html',
  './pages/login.html',
  './pages/register.html',
  './pages/reset-password.html',
  './pages/sell.html',
  './pages/vendre.html',
  './pages/withdraw.html',

  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './assets/images/logo-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // On tolère l'échec d'un fichier isolé pour ne pas bloquer toute
      // l'installation du service worker (fichier renommé/absent, etc.).
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] Précache ignoré:', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // On ne met en cache que les requêtes GET, même origine (le backend API
  // est sur un autre domaine et doit toujours passer par le réseau).
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached); // hors-ligne : on retombe sur le cache s'il existe

      // stale-while-revalidate : sert le cache immédiatement si dispo,
      // et le met à jour en arrière-plan pour la prochaine visite.
      return cached || network;
    })
  );
});
