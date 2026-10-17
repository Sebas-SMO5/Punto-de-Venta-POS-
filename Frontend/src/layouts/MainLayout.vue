<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const online = ref(navigator.onLine)

function updateConnection() {
  online.value = navigator.onLine
  console.log('Estado de conexión:', online.value)
}

function handleOffline() {
  online.value = false
  console.log('Evento offline detectado')
}

function handleOnline() {
  online.value = true
  console.log('Evento online detectado')
}

onMounted(() => {
  updateConnection()

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})

const menuItems = [
  { label: 'Dashboard', icon: '▦', to: '/' },
  { label: 'Punto de venta', icon: '＋', to: '/sales' },
  { label: 'Mesas', icon: '▤', to: '/tables' },
  { label: 'Productos', icon: '◇', to: '/products' },
]

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
    </aside>

    <main class="main-area">
      <header class="topbar">
        <div>
          <p class="eyebrow">GESTIÓN DEL RESTAURANTE</p>
          <h1>Panel de control</h1>
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
        </div>
      </header>

      <section class="page-content">
        <RouterView />
      </section>
    </main>
  </div>
</template>