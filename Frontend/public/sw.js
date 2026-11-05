const CACHE_NAME = 'restaurante-pos-v3'

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)

      const response = await fetch('/', {
        cache: 'reload'
      })

      if (!response.ok) {
        throw new Error('No se pudo cargar la aplicación')
      }

      await cache.put('/', response.clone())

      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith('restaurante-pos-') &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      )

      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET') return

  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/')) return

  if (url.pathname.includes('__vite_ping')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)

          if (response.ok) {
            const cache = await caches.open(CACHE_NAME)
            await cache.put('/', response.clone())
          }

          return response
        } catch {
          const cached = await caches.match('/')

          return cached || Response.error()
        }
      })()
    )

    return
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request)

        if (response.ok && response.type === 'basic') {
          const cache = await caches.open(CACHE_NAME)

          await cache.put(request, response.clone())
        }

        return response
      } catch {
        const cached = await caches.match(request)

        return cached || Response.error()
      }
    })()
  )
})