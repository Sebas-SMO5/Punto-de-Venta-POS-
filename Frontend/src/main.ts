// Punto de entrada del frontend: crea la aplicación Vue, conecta Pinia
// (estado global) y el router (pantallas), abre la base local IndexedDB y
// registra el Service Worker para que la app abra sin internet.
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/styles.css'
import { getDatabase } from './offline/db'
import { registerServiceWorker } from './offline/serviceWorker'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

getDatabase().catch((error) => {
  console.error('Error al iniciar el almacenamiento local:', error)
})

registerServiceWorker()
