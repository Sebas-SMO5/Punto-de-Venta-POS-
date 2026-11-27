<script setup lang="ts">
// Pantalla de sincronización: muestra la cola de operaciones guardadas en
// este dispositivo, los CONFLICTOS que necesitan una decisión y el
// historial de cómo se resolvió cada uno.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getAllOperations, retryFailedOperations } from '../offline/queue'
import {
  SYNC_EVENT,
  discardOperation,
  resolveConflict,
  synchronizeData,
} from '../offline/sync'
import { getSyncLog, type PendingOperation, type SyncLogEntry } from '../offline/db'

const online = ref(navigator.onLine)
const lastCheck = ref(new Date())
const operations = ref<PendingOperation[]>([])
const log = ref<SyncLogEntry[]>([])
const synchronizing = ref(false)
const message = ref('')

let refreshTimer: number | undefined

const ENTITY_LABELS: Record<string, string> = {
  products: 'Producto',
  categories: 'Categoría',
  orders: 'Pedido',
  sales: 'Venta',
  tables: 'Mesa',
}

const TYPE_LABELS: Record<string, string> = {
  CREATE: 'Crear',
  UPDATE: 'Modificar',
  DELETE: 'Eliminar / cancelar',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Enviando',
  error: 'Error',
  conflict: 'Conflicto',
}

const RESOLUTION_LABELS: Record<string, string> = {
  server_wins: 'Ganó el servidor',
  local_wins: 'Ganó este dispositivo',
  discarded: 'Descartada',
}

const queue = computed(() => operations.value.filter((op) => op.status !== 'conflict'))
const conflicts = computed(() => operations.value.filter((op) => op.status === 'conflict'))
const pendingCount = computed(
  () => operations.value.filter((op) => op.status === 'pending' || op.status === 'processing').length,
)
const errorCount = computed(() => operations.value.filter((op) => op.status === 'error').length)

function describe(op: PendingOperation): string {
  const name = typeof op.data.name === 'string' ? ` "${op.data.name}"` : ''
  return `${TYPE_LABELS[op.type] ?? op.type} ${ENTITY_LABELS[op.entity]?.toLowerCase() ?? op.entity}${name}`
}

function serverSummary(op: PendingOperation): string {
  const server = op.conflict?.server

  if (typeof server !== 'object' || server === null) return ''

  const data = server as Record<string, unknown>
  const parts: string[] = []

  if (data.name !== undefined) parts.push(`Nombre: ${String(data.name)}`)
  if (data.price !== undefined) parts.push(`Precio: ${Number(data.price).toLocaleString('es-CO')}`)
  if (data.version !== undefined) parts.push(`Versión: ${String(data.version)}`)

  return parts.join(' · ')
}

function localSummary(op: PendingOperation): string {
  const parts: string[] = []

  if (op.data.name !== undefined) parts.push(`Nombre: ${String(op.data.name)}`)
  if (op.data.price !== undefined) parts.push(`Precio: ${Number(op.data.price).toLocaleString('es-CO')}`)
  if (op.data.expectedVersion !== undefined) parts.push(`Basado en versión: ${String(op.data.expectedVersion)}`)

  return parts.join(' · ')
}

function localLabel(op: PendingOperation): string {
  return op.conflict?.reason === 'INSUFFICIENT_STOCK' ? 'Reintentar venta' : 'Mantener mi cambio'
}

function serverLabel(op: PendingOperation): string {
  return op.conflict?.reason === 'INSUFFICIENT_STOCK' ? 'Descartar venta' : 'Usar la del servidor'
}

async function refreshStatus() {
  online.value = navigator.onLine
  lastCheck.value = new Date()

  try {
    operations.value = await getAllOperations()
    log.value = await getSyncLog()
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

    message.value =
      errorCount.value || conflicts.value.length
        ? `Sincronización finalizada. ${errorCount.value + conflicts.value.length} operación(es) requieren revisión.`
        : 'Sincronización finalizada correctamente.'
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'No fue posible sincronizar.'
  } finally {
    synchronizing.value = false
    await refreshStatus()
  }
}

async function retryErrors() {
  await retryFailedOperations()
  await synchronize()
}

async function resolve(op: PendingOperation, choice: 'local' | 'server') {
  if (op.id === undefined) return
  await resolveConflict(op.id, choice)
  await refreshStatus()
}

async function discard(op: PendingOperation) {
  if (op.id === undefined) return
  if (!window.confirm('¿Descartar esta operación? El cambio no se enviará al servidor.')) return
  await discardOperation(op.id)
  await refreshStatus()
}

function updateConnection() {
  online.value = navigator.onLine
  if (online.value) void synchronize()
  else void refreshStatus()
}

onMounted(() => {
  void refreshStatus()
  window.addEventListener('online', updateConnection)
  window.addEventListener('offline', updateConnection)
  window.addEventListener(SYNC_EVENT, refreshStatus)
  refreshTimer = window.setInterval(refreshStatus, 3000)
})

onUnmounted(() => {
  window.removeEventListener('online', updateConnection)
  window.removeEventListener('offline', updateConnection)
  window.removeEventListener(SYNC_EVENT, refreshStatus)
  if (refreshTimer !== undefined) window.clearInterval(refreshTimer)
})
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Sincronización</h2>
        <p>Cambios hechos en este dispositivo y su envío al servidor.</p>
      </div>

      <div class="sync-actions">
        <button class="primary-button" :disabled="!online || synchronizing" @click="synchronize">
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

    <div v-if="message" class="sync-message" role="status">{{ message }}</div>

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
        <p class="stat-label">Conflictos por resolver</p>
        <h3>{{ conflicts.length }}</h3>
      </article>
      <article class="stat-card">
        <p class="stat-label">Operaciones con error</p>
        <h3>{{ errorCount }}</h3>
      </article>
    </div>

    <section v-if="conflicts.length" class="panel conflict-panel">
      <div class="panel-heading">
        <div>
          <h3>Conflictos por resolver</h3>
          <p>Estos cambios chocan con cambios hechos en el servidor. Elija qué hacer con cada uno.</p>
        </div>
      </div>

      <article v-for="op in conflicts" :key="op.id" class="conflict-card">
        <header>
          <strong>{{ describe(op) }}</strong>
          <small>{{ new Date(op.createdAt).toLocaleString('es-CO') }}</small>
        </header>

        <p class="conflict-reason">{{ op.conflict?.message }}</p>

        <div class="conflict-compare">
          <div>
            <span>En este dispositivo</span>
            <p>{{ localSummary(op) || 'Cambio local' }}</p>
          </div>
          <div v-if="serverSummary(op)">
            <span>En el servidor</span>
            <p>{{ serverSummary(op) }}</p>
          </div>
        </div>

        <div class="sync-actions">
          <button class="primary-button" :disabled="!online" @click="resolve(op, 'local')">
            {{ localLabel(op) }}
          </button>
          <button class="secondary-button" @click="resolve(op, 'server')">
            {{ serverLabel(op) }}
          </button>
        </div>
      </article>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h3>Cola de operaciones</h3>
          <p>Última comprobación: {{ lastCheck.toLocaleString('es-CO') }}</p>
        </div>
        <span class="status-pill" :class="online ? 'ready' : 'pending'">
          {{ online ? 'Conectado' : 'Desconectado' }}
        </span>
      </div>

      <div v-if="queue.length" class="sync-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Operación</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Intentos</th>
              <th>Detalle</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="op in queue" :key="op.id">
              <td>{{ describe(op) }}</td>
              <td>{{ new Date(op.createdAt).toLocaleString('es-CO') }}</td>
              <td>{{ STATUS_LABELS[op.status] }}</td>
              <td>{{ op.attempts }}</td>
              <td>{{ op.error || '—' }}</td>
              <td>
                <button v-if="op.status === 'error'" class="table-action delete-action" @click="discard(op)">
                  Descartar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="empty-state">No hay operaciones pendientes. Todo está sincronizado.</p>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h3>Historial de resolución</h3>
          <p>Cómo se resolvió cada conflicto (automática o manualmente).</p>
        </div>
      </div>

      <table v-if="log.length" class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Operación</th>
            <th>Resultado</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in log.slice(0, 20)" :key="entry.id">
            <td>{{ new Date(entry.at).toLocaleString('es-CO') }}</td>
            <td>{{ TYPE_LABELS[entry.type] }} {{ ENTITY_LABELS[entry.entity]?.toLowerCase() }}</td>
            <td>{{ RESOLUTION_LABELS[entry.resolution] }}</td>
            <td>{{ entry.message }}</td>
          </tr>
        </tbody>
      </table>

      <p v-else class="empty-state">Todavía no se ha resuelto ningún conflicto.</p>
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

.panel + .panel {
  margin-top: 18px;
}

.conflict-panel {
  margin-bottom: 18px;
  border: 1px solid #f5c26b;
}

.conflict-card {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 10px;
  background: #fffaf0;
}

.conflict-card header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.conflict-card small {
  color: #718096;
}

.conflict-reason {
  margin: 8px 0;
  color: #8a5a00;
}

.conflict-compare {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.conflict-compare span {
  font-size: 12px;
  font-weight: 600;
  color: #445064;
}

.conflict-compare p {
  margin: 4px 0 0;
}

button:disabled {
  opacity: 0.55;
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
