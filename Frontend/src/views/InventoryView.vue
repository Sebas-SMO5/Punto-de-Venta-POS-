<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../services/api'

interface InventoryItem {
  id: number
  product: string
  stock: number
  minimum: number
}

const inventory = ref<InventoryItem[]>([])
const search = ref('')
const isLoading = ref(false)

const filteredInventory = computed(() =>
  inventory.value.filter(item =>
    item.product.toLowerCase().includes(search.value.toLowerCase())
  )
)

const lowStockCount = computed(() =>
  inventory.value.filter(item => item.stock <= item.minimum).length
)

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO').format(Number(value))
}

async function loadInventory() {
  isLoading.value = true

  try {
    const response = await api.get('/inventory')
    inventory.value = response.data.map((item: InventoryItem) => ({
      ...item,
      stock: Number(item.stock),
      minimum: Number(item.minimum)
    }))
  } catch (error) {
    console.error('Error al cargar inventario:', error)
    alert('No se pudo cargar el inventario.')
  } finally {
    isLoading.value = false
  }
}

onMounted(loadInventory)
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Inventario</h2>
        <p>Consulta las existencias y los niveles mínimos de los productos.</p>
      </div>
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
        <h3>
          {{ formatNumber(inventory.reduce((sum, item) => sum + item.stock, 0)) }}
        </h3>
      </article>
    </div>

    <section class="panel">
      <div class="product-filters">
        <input
          v-model="search"
          class="search-input"
          placeholder="Buscar producto..."
        >
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Existencias</th>
              <th>Stock mínimo</th>
              <th>Estado</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="isLoading">
              <td colspan="4">Cargando inventario...</td>
            </tr>

            <tr v-for="item in filteredInventory" :key="item.id">
              <td><strong>{{ item.product }}</strong></td>
              <td>{{ formatNumber(item.stock) }}</td>
              <td>{{ formatNumber(item.minimum) }}</td>

              <td>
                <span
                  class="status-pill"
                  :class="item.stock <= item.minimum ? 'pending' : 'ready'"
                >
                  {{ item.stock <= item.minimum ? 'Stock bajo' : 'Disponible' }}
                </span>
              </td>
            </tr>

            <tr v-if="!isLoading && filteredInventory.length === 0">
              <td colspan="4" class="empty-state">
                No hay existencias cargadas.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="demo-notice">
      El inventario se consulta directamente desde PostgreSQL.
    </p>
  </div>
</template>