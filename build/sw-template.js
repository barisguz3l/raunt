/* Raunt service worker: tamamen çevrimdışı çalışma (ağ isteği yapılmaz, yalnızca önbellek). */
const CACHE = 'raunt-__VERSION__'
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        // Bir önceki sürüm bir sürüm daha saklanır: açık sayfa eski dosyayı isterse çevrimdışı da bulunsun
        const old = keys.filter((k) => k.startsWith('raunt-') && k !== CACHE && k !== 'raunt-ai').sort()
        return Promise.all(old.slice(0, -1).map((k) => caches.delete(k)))
      })
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  event.respondWith(
    // Önce bu sürümün önbelleği (eski sürümün index.html'i asla öne geçmesin), sonra diğerleri
    caches
      .open(CACHE)
      .then((cur) => cur.match(req, { ignoreSearch: true }).then((own) => own || caches.match(req, { ignoreSearch: true })))
      .then((hit) => {
      if (hit) return hit
      // Yapay zekâ dosyaları: ilk istekte indir ve sakla (sonra çevrimdışı)
      const path = new URL(req.url).pathname
      if (path.includes('/mediapipe/') || path.includes('/models/')) {
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open('raunt-ai').then((c) => c.put(req, copy))
          }
          return res
        })
      }
      // Sayfa gezintisi önbellekte yoksa uygulama kabuğunu döndür.
      if (req.mode === 'navigate') return caches.open(CACHE).then((c) => c.match('./index.html'))
      return fetch(req)
    }),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'raunt-clear-old') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('raunt-') && k !== CACHE && k !== 'raunt-ai').map((k) => caches.delete(k)))),
    )
  }
})
