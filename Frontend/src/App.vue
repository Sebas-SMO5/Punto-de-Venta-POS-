<script setup lang="ts">
// Componente raíz. Inicia la sincronización automática y, si la sesión
// termina (por ejemplo, se cerró desde otro dispositivo), lleva al login
// sin recargar la página.
import { onMounted, onUnmounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { startAutoSync, stopAutoSync } from './offline/sync'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    if (!authenticated && !route.meta.public) {
      router.replace({ name: 'login', query: { redirect: route.fullPath } })
    }
  },
)

onMounted(() => {
  startAutoSync()
})

onUnmounted(() => {
  stopAutoSync()
})
</script>

<template>
  <RouterView />
</template>
