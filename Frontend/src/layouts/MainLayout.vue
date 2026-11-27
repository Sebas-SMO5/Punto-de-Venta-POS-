<script setup lang="ts">
// Estructura general de la app: menú lateral, barra superior y el espacio
// donde se muestra cada pantalla. El menú solo muestra las opciones que el
// rol del usuario puede usar.
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ROLE_LABELS, type Role } from '../types/models'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

async function logout() {
  await auth.logout()
  await router.replace('/login')
}

const online = ref(navigator.onLine)

function handleOffline() {
  online.value = false
}

function handleOnline() {
  online.value = true
}

onMounted(() => {
  online.value = navigator.onLine
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})

interface MenuItem {
  label: string
  icon: string
  to: string
  roles?: Role[]
}

const allMenuItems: MenuItem[] = [
  { label: 'Dashboard', icon: '▦', to: '/' },
  { label: 'Punto de venta', icon: '＋', to: '/sales' },
  { label: 'Mesas', icon: '▤', to: '/tables' },
  { label: 'Productos', icon: '◇', to: '/products' },
  { label: 'Categorías', icon: '▧', to: '/categories', roles: ['admin'] },
  { label: 'Pedidos', icon: '☷', to: '/orders' },
  { label: 'Inventario', icon: '▤', to: '/inventory', roles: ['admin', 'cashier'] },
  { label: 'Historial de ventas', icon: '▥', to: '/sales-history', roles: ['admin', 'cashier'] },
  { label: 'Sincronización', icon: '⟳', to: '/sync' },
  { label: 'Mis sesiones', icon: '⚿', to: '/sessions' },
]

const menuItems = computed(() =>
  allMenuItems.filter((item) => !item.roles || auth.hasRole(...item.roles)),
)

const roleLabel = computed(() => (auth.role ? ROLE_LABELS[auth.role] : ''))
const pageTitle = computed(() => route.meta.title ?? 'Panel de control')
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon">R</div>
        <div>
          <h2>Restaurante POS</h2>
          <span>Sistema de gestión</span>
        </div>
      </div>

      <p class="menu-label">MENÚ PRINCIPAL</p>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in menuItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          active-class="active"
          exact-active-class="active"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <span
          class="status-dot"
          :class="{ offline: !online }"
        ></span>
        <div>
          <strong>{{ online ? 'Conectado' : 'Sin conexión' }}</strong>
          <small>Estado de red</small>
        </div>
      </div>

      <div class="sidebar-user">
        <div>
          <strong>{{ auth.user?.username }}</strong>
          <small>{{ roleLabel }}</small>
        </div>
        <button type="button" class="logout-btn" @click="logout">Salir</button>
      </div>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <div>
          <p class="eyebrow">GESTIÓN DEL RESTAURANTE</p>
          <h1>{{ pageTitle }}</h1>
        </div>

        <div
          class="connection-badge"
          :class="{ 'connection-offline': !online }"
          role="status"
          aria-live="polite"
        >
          <span
            class="status-dot"
            :class="{ offline: !online }"
          ></span>
          <span>{{ online ? 'En línea' : 'Sin conexión' }}</span>
          <span v-if="auth.offlineMode && online" class="offline-session">· reconectando sesión</span>
        </div>
      </header>

      <section class="page-content">
        <RouterView />
      </section>
    </main>
  </div>
</template>

