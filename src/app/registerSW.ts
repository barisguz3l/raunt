// Service worker yalnızca üretim derlemesinde kaydedilir (geliştirmede önbellek kafa karıştırmasın).
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW kaydı başarısız', err))
  })
}
