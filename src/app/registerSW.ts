// Service worker yalnızca üretim derlemesinde kaydedilir (geliştirmede önbellek kafa karıştırmasın).
//
// Güncelleme akışı (iPhone ana ekran uygulamasında yeni sürüm hemen görünsün):
//  - sw.js HTTP önbelleğinden okunmaz (GitHub Pages 10 dk önbellekliyor) → updateViaCache: 'none'
//  - uygulama her öne geldiğinde güncelleme kontrol edilir
//  - yeni sürüm denetimi devraldığında sayfa bir kez yenilenir; antrenman sürüyorsa bitince

let busy = false
let pendingReload = false

/** Antrenman sırasında yenileme yapılmasın (App çağırır). */
export function setUpdateBusy(b: boolean) {
  busy = b
  if (!b && pendingReload) window.location.reload()
}

/** Ayarlar › Güncellemeyi denetle: yeni sürümü indir, eski önbellekleri sil, sayfayı yenile. */
export async function forceUpdate(): Promise<void> {
  if (!('serviceWorker' in navigator)) return window.location.reload()
  const reg = await navigator.serviceWorker.getRegistration()
  if (reg) {
    await reg.update().catch(() => undefined)
    // Yeni sürüm kuruluyorsa bitmesini kısa süre bekle
    const sw = reg.installing ?? reg.waiting
    if (sw)
      await new Promise<void>((resolve) => {
        const done = () => sw.state === 'activated' && resolve()
        sw.addEventListener('statechange', done)
        setTimeout(resolve, 8000)
      })
    reg.active?.postMessage('raunt-clear-old')
  }
  // Eski uygulama önbelleklerini sayfadan da sil (yapay zekâ modeli kalsın)
  if ('caches' in window) {
    const keys = await caches.keys()
    const current = keys.filter((k) => k.startsWith('raunt-') && k !== 'raunt-ai').sort().pop()
    await Promise.all(keys.filter((k) => k.startsWith('raunt-') && k !== 'raunt-ai' && k !== current).map((k) => caches.delete(k)))
  }
  window.location.reload()
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const hadController = !!navigator.serviceWorker.controller
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // İlk kurulumda (önceden denetleyen yokken) yenileme gereksiz
    if (!hadController || reloaded) return
    reloaded = true
    if (busy) pendingReload = true
    else window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        const check = () => void reg.update().catch(() => undefined)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check()
        })
        // Uzun açık kalırsa saatte bir
        setInterval(check, 60 * 60 * 1000)
      })
      .catch((err) => console.warn('SW kaydı başarısız', err))
  })
}
