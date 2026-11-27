// Service Worker del POS: guarda la "cáscara" de la aplicación (HTML, JS,
// CSS e íconos) para que abra sin conexión.
//
// Estrategias:
// - Páginas (navegación): primero la red; si no hay red, la copia guardada.
// - Archivos de /assets/: primero la copia (tienen nombre único por versión).
// - /api/: NUNCA se guarda aquí. Los datos offline los maneja IndexedDB.
const CACHE = 'restaurante-pos-v4'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.ico']

// Al instalarse, guarda la página y también los archivos JS/CSS que ella
// usa (los busca dentro del HTML), para que la app abra sin conexión.
async function cacheShell() {
  const cache = await caches.open(CACHE)
  await cache.addAll(SHELL)

  const html = await (await fetch('/index.html', { cache: 'reload' })).text()
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])

  await cache.addAll(assets)
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html', { ignoreVary: true }))
    )
    return
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && url.pathname.startsWith('/assets/')) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
    )
  )
})
