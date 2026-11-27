import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // En desarrollo, las peticiones a /api se reenvían al backend.
    // Así página y API parecen estar en el mismo sitio (igual que en la nube)
    // y la cookie del refresh token funciona sin configuraciones extra.
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
})
