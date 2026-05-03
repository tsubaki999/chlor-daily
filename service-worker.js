// クロア (Chlor.) Service Worker
// v0.7+ #13: PWA / オフライン対応
// 戦略: stale-while-revalidate (古いキャッシュをまず表示し、バックグラウンドで最新取得)

const CACHE_VERSION = 'chlor-v0.7-1';
const CACHE_NAMES = {
  static: `${CACHE_VERSION}-static`,
  pages:  `${CACHE_VERSION}-pages`,
};
const STATIC_ASSETS = [
  '/chlor-daily/',
  '/chlor-daily/manifest.json',
  '/chlor-daily/og-image.png',
];

// install: 静的アセットをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAMES.static).then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// activate: 古いバージョンのキャッシュを掃除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(n => !Object.values(CACHE_NAMES).includes(n))
          .map(n => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// fetch: stale-while-revalidate
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 同一オリジンのページのみキャッシュ対象 (CDN・API は対象外)
  if (url.origin !== location.origin) return;

  // index.html / zone HTML
  if (url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    event.respondWith(
      caches.open(CACHE_NAMES.pages).then(cache =>
        cache.match(req).then(cached => {
          const fetched = fetch(req).then(resp => {
            if (resp && resp.status === 200) cache.put(req, resp.clone());
            return resp;
          }).catch(() => cached);
          // 即返しでオフライン即時表示、バックグラウンドで更新
          return cached || fetched;
        })
      )
    );
    return;
  }

  // 静的アセット
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(() => cached))
  );
});

// Notification (Web Notification API、サーバ Push 不要の MVP)
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/chlor-daily/')
  );
});
