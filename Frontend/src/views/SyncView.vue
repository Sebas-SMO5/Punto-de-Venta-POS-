<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const online = ref(navigator.onLine)
const lastCheck = ref(new Date())

function updateConnection() {
  online.value = navigator.onLine
  lastCheck.value = new Date()
}

onMounted(() => {
  window.addEventListener('online', updateConnection)
  window.addEventListener('offline', updateConnection)
})

onUnmounted(() => {
  window.removeEventListener('online', updateConnection)
  window.removeEventListener('offline', updateConnection)
})
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Sincronización</h2>
        <p>Estado de conexión y sincronización de la información del POS.</p>
      </div>
    </div>

    <div class="stats-grid products-summary">
      <article class="stat-card">
        <p class="stat-label">Conexión del dispositivo</p>
        <h3>{{ online ? 'En línea' : 'Sin conexión' }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Operaciones pendientes</p>
        <h3>—</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Conflictos por resolver</p>
        <h3>—</h3>
      </article>
    </div>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h3>Estado de red</h3>
          <p>
            Última comprobación:
            {{ lastCheck.toLocaleString('es-CO') }}
          </p>
        </div>

        <span
          class="status-pill"
          :class="online ? 'ready' : 'pending'"
        >
          {{ online ? 'Conectado' : 'Desconectado' }}
        </span>
      </div>

      <p class="empty-state">
        La cola de operaciones, el envío al servidor y la resolución de conflictos
        todavía no están conectados a las tablas sync_operations y sync_conflicts
        de PostgreSQL.
      </p>
    </section>
  </div>
</template>