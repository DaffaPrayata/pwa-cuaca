const CACHE_NAME = 'atmos-weather-v1'
const APP_SHELL = ['/', '/manifest.json', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const requestUrl = new URL(event.request.url)
  const isApiRequest = requestUrl.hostname === 'api.open-meteo.com' || requestUrl.hostname === 'geocoding-api.open-meteo.com' || requestUrl.pathname.startsWith('/api/')
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone()
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
    return response
  }).catch(() => caches.match(event.request).then((cached) => cached || (isApiRequest ? Response.error() : caches.match('/')))))
})
