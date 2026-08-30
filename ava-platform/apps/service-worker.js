// ═══════════════════════════════════════════════════════════════
// AvaHealth Mobile — PWA Service Worker (v3.0.0)
// Offline caching & Push Notification Bridge
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'avahealth-mobile-v3.0.0';
const STATIC_ASSETS = [
  '/apps/index.html',
  '/apps/style.css',
  '/apps/app.js',
  '/apps/manifest.json',
  '/css/logo-ava-global.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[AvaHealth SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Network first with cache fallback for data, cache first for static assets
  if (event.request.url.includes('/auth/v1') || event.request.url.includes('/rest/v1')) {
    return; // Pass through live database API requests
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Fetch background update
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/apps/index.html');
        }
      });
    })
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'AvaHealth', body: 'Notifikasi kesehatan baru.' };
  const options = {
    body: data.body || 'Pemberitahuan dari PT AVA Health Solution',
    icon: '/css/logo-ava-global.png',
    badge: '/css/logo-ava-global.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/apps/index.html' }
  };
  event.waitUntil(self.registration.showNotification(data.title || 'AvaHealth', options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/apps/index.html')
  );
});
