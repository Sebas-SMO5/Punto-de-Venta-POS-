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