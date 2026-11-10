<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  getAllOperations,
  retryFailedOperations
} from '../offline/queue'
import { synchronizeData } from '../offline/sync'
import type { PendingOperation } from '../offline/db'

const online = ref(navigator.onLine)
const lastCheck = ref(new Date())
const operations = ref<PendingOperation[]>([])
const synchronizing = ref(false)
const message = ref('')

let refreshTimer: number | undefined

const pendingCount = computed(() =>
  operations.value.filter(item =>
    item.status === 'pending' || item.status === 'processing'
  ).length
)

const errorCount = computed(() =>
  operations.value.filter(item => item.status === 'error').length
)

async function refreshStatus() {
  online.value = navigator.onLine
  lastCheck.value = new Date()

  try {
    operations.value = await getAllOperations()
  } catch (error) {
    console.error('Error al consultar la cola:', error)
  }
}

async function synchronize() {
  if (!navigator.onLine) {
    message.value = 'No hay conexión. Las operaciones permanecerán guardadas en este dispositivo.'
    return
  }

  if (synchronizing.value) return

  synchronizing.value = true
  message.value = ''

  try {
    await synchronizeData()
    await refreshStatus()

    message.value = errorCount.value
      ? `Sincronización finalizada. ${errorCount.value} operación(es) requieren revisión.`
      : 'Sincronización finalizada correctamente.'
  } catch (error) {
    message.value = error instanceof Error
      ? error.message
      : 'No fue posible sincronizar.'
  } finally {
    synchronizing.value = false
    await refreshStatus()
  }
}

async function retryErrors() {
  try {
    await retryFailedOperations()
    await refreshStatus()
    await synchronize()
  } catch (error) {
    console.error('Error al reintentar operaciones:', error)
    message.value = 'No fue posible reintentar las operaciones.'
  }
}

function updateConnection() {
  online.value = navigator.onLine

  if (online.value) {
    synchronize()
  } else {
    refreshStatus()
  }
}

onMounted(() => {
  refreshStatus()

  window.addEventListener('online', updateConnection)
  window.addEventListener('offline', updateConnection)

  refreshTimer = window.setInterval(refreshStatus, 3000)
})

onUnmounted(() => {
  window.removeEventListener('online', updateConnection)
  window.removeEventListener('offline', updateConnection)

  if (refreshTimer !== undefined) {
    window.clearInterval(refreshTimer)
  }
})
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Sincronización</h2>
        <p>Estado de conexión y sincronización de la información del POS.</p>
      </div>

      <div class="sync-actions">
        <button
          class="primary-button"
          :disabled="!online || synchronizing"
          @click="synchronize"
        >
          {{ synchronizing ? 'Sincronizando...' : 'Sincronizar ahora' }}
        </button>

        <button
          v-if="errorCount"
          class="secondary-button"
          :disabled="!online || synchronizing"
          @click="retryErrors"
        >
          Reintentar errores
        </button>
      </div>
    </div>

    <div v-if="message" class="sync-message">
      {{ message }}
    </div>

    <div class="stats-grid products-summary">
      <article class="stat-card">
        <p class="stat-label">Conexión del dispositivo</p>
        <h3>{{ online ? 'En línea' : 'Sin conexión' }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Operaciones pendientes</p>
        <h3>{{ pendingCount }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Operaciones con error</p>
        <h3>{{ errorCount }}</h3>
      </article>
    </div>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h3>Estado de red</h3>
          <p>Última comprobación: {{ lastCheck.toLocaleString('es-CO') }}</p>
        </div>

        <span
          class="status-pill"
          :class="online ? 'ready' : 'pending'"
        >
          {{ online ? 'Conectado' : 'Desconectado' }}
        </span>
      </div>

      <div v-if="operations.length" class="sync-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Entidad</th>
              <th>Operación</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Intentos</th>
              <th>Detalle</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="operation in operations"
              :key="operation.id"
            >
              <td>{{ operation.entity }}</td>
              <td>{{ operation.type }}</td>

              <td>
                {{ new Date(operation.createdAt).toLocaleString('es-CO') }}
              </td>

              <td>
                {{ operation.status === 'pending'
                  ? 'Pendiente'
                  : operation.status === 'processing'
                    ? 'Procesando'
                    : 'Error'
                }}
              </td>

              <td>{{ operation.attempts }}</td>
              <td>{{ operation.error || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="empty-state">
        No hay operaciones pendientes. Los cambios locales se enviarán al servidor cuando se generen nuevas operaciones.
      </p>

      <p class="sync-note">
        La cola se consulta desde IndexedDB. Las operaciones con error se conservan para permitir su reintento.
      </p>
    </section>
  </div>
</template>

<style scoped>
.sync-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.sync-message {
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #e8f5ed;
  color: #147447;
}

.sync-table-wrap {
  overflow-x: auto;
  margin-top: 18px;
}

.sync-note {
  margin-top: 16px;
  color: #718096;
  font-size: 12px;
}

button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.secondary-button {
  padding: 11px 15px;
  border: 1px solid #e1e6ee;
  border-radius: 9px;
  color: #445064;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
}
</style>