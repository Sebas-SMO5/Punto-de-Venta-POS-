<script setup lang="ts">
// Pantalla de inventario: ver existencias, registrar entradas de mercancía
// (admin y cajero, también sin conexión) y ajustes por conteo (solo admin),
// y consultar el historial de movimientos.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  inventoryService,
  type InventoryItem,
  type InventoryMovement,
} from '../services/inventory.service'
import { errorMessage } from '../services/api'
import { useAuthStore } from '../stores/auth'
import { formatDate } from '../utils/format'
import StockMovementModal from '../components/inventory/StockMovementModal.vue'

const auth = useAuthStore()

const inventory = ref<InventoryItem[]>([])
const movements = ref<InventoryMovement[]>([])
const search = ref('')
const isLoading = ref(false)
const loadError = ref('')
const isOffline = ref(!navigator.onLine)

const selected = ref<InventoryItem | null>(null)
const movementType = ref<'entry' | 'adjustment'>('entry')
const saving = ref(false)

const MOVEMENT_LABELS: Record<string, string> = {
  entry: 'Entrada',
  exit: 'Venta',
  adjustment: 'Ajuste',
}

const filteredInventory = computed(() =>
  inventory.value.filter((item) => item.product.toLowerCase().includes(search.value.toLowerCase())),
)

const lowStockCount = computed(() => inventory.value.filter((item) => item.stock <= item.minimum).length)
const totalStock = computed(() => inventory.value.reduce((sum, item) => sum + Number(item.stock || 0), 0))

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO').format(Number(value || 0))
}

async function loadMovements() {
  if (!navigator.onLine) return

  try {
    movements.value = await inventoryService.getMovements()
  } catch (error) {
    console.error('Error al cargar movimientos:', error)
  }
}

async function loadInventory() {
  isLoading.value = true
  loadError.value = ''
  isOffline.value = !navigator.onLine

  try {
    inventory.value = await inventoryService.getAll()
  } catch (error) {
    loadError.value = errorMessage(error, 'No se pudo cargar el inventario.')
  } finally {
    isLoading.value = false
  }

  await loadMovements()
}

function open(item: InventoryItem, type: 'entry' | 'adjustment') {
  selected.value = item
  movementType.value = type
}

async function saveMovement(quantity: number, reason: string) {
  if (!selected.value) return

  saving.value = true

  try {
    const { item, offline } = await inventoryService.registerMovement({
      productId: selected.value.id,
      type: movementType.value,
      quantity,
      reason,
    })

    inventory.value = inventory.value.map((current) => (current.id === item.id ? item : current))
    selected.value = null

    alert(
      offline
        ? `Entrada guardada sin conexión. Stock: ${item.stock}.\nSe sincronizará cuando vuelva internet.`
        : `Inventario actualizado. Stock de ${item.product}: ${item.stock}.`,
    )

    await loadMovements()
  } catch (error) {
    alert(errorMessage(error, 'No se pudo registrar el movimiento.'))
  } finally {
    saving.value = false
  }
}

function handleConnectionChange() {
  isOffline.value = !navigator.onLine
  if (navigator.onLine) void loadInventory()
}

onMounted(() => {
  void loadInventory()
  window.addEventListener('online', handleConnectionChange)
  window.addEventListener('offline', handleConnectionChange)
})

onUnmounted(() => {
  window.removeEventListener('online', handleConnectionChange)
  window.removeEventListener('offline', handleConnectionChange)
})
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Inventario</h2>
        <p>Existencias de cada producto, entradas de mercancía y ajustes por conteo.</p>
      </div>
    </div>

    <div v-if="isOffline" class="demo-notice">
      Sin conexión: puede registrar entradas (se sincronizan después). Los ajustes necesitan internet.
    </div>

    <div class="stats-grid products-summary">
      <article class="stat-card">
        <p class="stat-label">Productos inventariados</p>
        <h3>{{ inventory.length }}</h3>
      </article>
      <article class="stat-card">
        <p class="stat-label">Existencias bajas</p>
        <h3>{{ lowStockCount }}</h3>
      </article>
      <article class="stat-card">
        <p class="stat-label">Existencias registradas</p>
        <h3>{{ formatNumber(totalStock) }}</h3>
      </article>
    </div>

    <section class="panel">
      <div class="product-filters">
        <input v-model="search" class="search-input" placeholder="Buscar producto..." />
      </div>

      <div v-if="loadError" class="error-message">{{ loadError }}</div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Existencias</th>
              <th>Stock mínimo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="isLoading && !inventory.length">
              <td colspan="5">Cargando inventario...</td>
            </tr>

            <tr v-for="item in filteredInventory" :key="item.id">
              <td><strong>{{ item.product }}</strong></td>
              <td>{{ formatNumber(item.stock) }}</td>
              <td>{{ formatNumber(item.minimum) }}</td>
              <td>
                <span class="status-pill" :class="item.stock <= item.minimum ? 'pending' : 'ready'">
                  {{ item.stock <= item.minimum ? 'Stock bajo' : 'Disponible' }}
                </span>
              </td>
              <td>
                <div class="product-actions">
                  <button class="table-action" @click="open(item, 'entry')">+ Entrada</button>
                  <button
                    v-if="auth.isAdmin"
                    class="table-action"
                    :disabled="isOffline"
                    :title="isOffline ? 'Necesita conexión' : ''"
                    @click="open(item, 'adjustment')"
                  >
                    Ajustar
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="!isLoading && filteredInventory.length === 0">
              <td colspan="5" class="empty-state">No hay existencias cargadas.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel movements-panel">
      <div class="panel-heading">
        <div>
          <h3>Últimos movimientos</h3>
          <p>Entradas, ajustes y salidas por ventas, con quién los hizo.</p>
        </div>
      </div>

      <p v-if="isOffline" class="empty-state">El historial se consulta con conexión.</p>

      <div v-else-if="movements.length" class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Tipo</th>
              <th>Cantidad</th>
              <th>Stock</th>
              <th>Usuario</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="movement in movements" :key="movement.id">
              <td>{{ formatDate(movement.created_at) }}</td>
              <td>{{ movement.product }}</td>
              <td>{{ MOVEMENT_LABELS[movement.type] ?? movement.type }}</td>
              <td>{{ movement.type === 'exit' ? '−' : movement.type === 'entry' ? '+' : '±' }}{{ formatNumber(movement.quantity) }}</td>
              <td>{{ formatNumber(movement.previous_stock) }} → {{ formatNumber(movement.new_stock) }}</td>
              <td>{{ movement.user_name || '—' }}</td>
              <td>{{ movement.reason || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="empty-state">Todavía no hay movimientos registrados.</p>
    </section>

    <StockMovementModal
      v-if="selected"
      :item="selected"
      :type="movementType"
      :busy="saving"
      @close="selected = null"
      @confirm="saveMovement"
    />
  </div>
</template>

<style scoped>
.movements-panel {
  margin-top: 18px;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
