// Registra el Service Worker (archivo public/sw.js).
// Un Service Worker es un pequeño programa que el navegador mantiene
// instalado y que guarda una copia de la página (HTML, JS, CSS). Gracias a
// él, la aplicación ABRE aunque no haya internet, incluso si se recarga.
// Solo se activa en producción (npm run build), para no estorbar mientras
// se programa con "npm run dev".
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('No se pudo registrar el Service Worker:', error)
    })
  })
}
