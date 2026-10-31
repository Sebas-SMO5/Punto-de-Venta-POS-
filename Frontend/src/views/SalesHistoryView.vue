<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../services/api'

interface Sale {
  id: number
  sale_number: string | number
  created_at: string
  total: number | string
  status: string
  items: {
    id: number
    name: string
    quantity: number
    price: number
    subtotal: number
  }[]
  payments: {
    id: number
    amount: number
    status: string
    method: string
    reference: string
  }[]
}

const sales = ref<Sale[]>([])
const search = ref('')
const isLoading = ref(false)

const filteredSales = computed(() =>
  sales.value.filter(sale =>
    String(sale.sale_number)
      .toLowerCase()
      .includes(search.value.toLowerCase())
  )
)

const totalSales = computed(() =>
  sales.value.reduce((sum, sale) => sum + Number(sale.total), 0)
)

const completedSales = computed(() =>
  sales.value.filter(sale => sale.status === 'completed').length
)

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(value))
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CO')
}

async function loadSales() {
  isLoading.value = true

  try {
    const response = await api.get<Sale[]>('/sales')

    sales.value = response.data.map(sale => ({
      ...sale,
      total: Number(sale.total),
      items: sale.items || [],
      payments: sale.payments || []
    }))
  } catch (error) {
    console.error('Error al cargar ventas:', error)
    alert('No se pudieron cargar las ventas.')
  } finally {
    isLoading.value = false
  }
}

onMounted(loadSales)
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Historial de ventas</h2>
        <p>Consulta las ventas realizadas y sus valores.</p>
      </div>
    </div>

    <div class="stats-grid products-summary">
      <article class="stat-card">
        <p class="stat-label">Ventas registradas</p>
        <h3>{{ sales.length }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Total vendido</p>
        <h3>{{ formatCurrency(totalSales) }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Ventas completadas</p>
        <h3>{{ completedSales }}</h3>
      </article>
    </div>

    <section class="panel">
      <div class="product-filters">
        <input
          v-model="search"
          class="search-input"
          placeholder="Buscar por número de venta..."
        >
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Número de venta</th>
              <th>Fecha</th>
              <th>Productos</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="isLoading">
              <td colspan="5">Cargando ventas...</td>
            </tr>

            <tr
              v-for="sale in filteredSales"
              :key="sale.id"
            >
              <td>
                <strong>#{{ sale.sale_number }}</strong>
              </td>

              <td>{{ formatDate(sale.created_at) }}</td>

              <td>
                {{ sale.items.reduce((sum, item) => sum + Number(item.quantity), 0) }}
                unidades
              </td>

              <td>{{ formatCurrency(sale.total) }}</td>

              <td>
                <span
                  class="status-pill"
                  :class="sale.status === 'completed' ? 'ready' : 'pending'"
                >
                  {{ sale.status }}
                </span>
              </td>
            </tr>

            <tr v-if="!isLoading && filteredSales.length === 0">
              <td colspan="5" class="empty-state">
                No hay ventas para mostrar.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="demo-notice">
      Las ventas se consultan directamente desde PostgreSQL.
    </p>
  </div>
</template>