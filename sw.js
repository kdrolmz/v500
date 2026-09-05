const CACHE_NAME = 'ko-v500-shell-v1';

const LOCAL_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './app-icon-512.png'
];

const VERIFIED_EXTERNAL_SCRIPTS = [
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled([...LOCAL_SHELL, ...VERIFIED_EXTERNAL_SCRIPTS].map(async url => {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok && response.type !== 'opaque') throw new Error('Önbelleğe alınamadı: ' + url);
      await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('ko-v500-shell-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

const isSensitivePublicFile = url => /\.(?:ics|json)$/i.test(url.pathname) && !/\/manifest\.json$/i.test(url.pathname);

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Takvim, veri, Firebase ve GitHub istekleri hiçbir zaman service worker
  // önbelleğine yazılmaz. Böylece kişisel/operasyonel veri cihaz önbelleğinde
  // ikinci bir kopya oluşturmaz.
  if (isSensitivePublicFile(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request);
        if (fresh.ok) await cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  const allowed = url.origin === self.location.origin || VERIFIED_EXTERNAL_SCRIPTS.includes(url.href);
  if (!allowed) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    const fresh = await fetch(request);
    if (fresh.ok || fresh.type === 'opaque') await cache.put(request, fresh.clone());
    return fresh;
  })());
});
