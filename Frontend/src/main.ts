import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/styles.css'
import { getDatabase } from './offline/db'
import { startAutoSync } from './offline/sync'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

getDatabase()
  .then(() => {
    startAutoSync()
  })
  .catch(error => {
    console.error('Error al iniciar el almacenamiento local:', error)
  })

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })

      await registration.update()

      console.log('Service Worker registrado correctamente')
    } catch (error) {
      console.error('Error al registrar el Service Worker:', error)
    }
  })
}