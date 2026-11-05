<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  salesService,
  type Sale
} from '../services/sales.service'

const sales = ref<Sale[]>([])
const search = ref('')
const isLoading = ref(false)
const selectedSale = ref<Sale | null>(null)
const isLoadingDetail = ref(false)
const isOffline = ref(!navigator.onLine)
const errorMessage = ref('')

const filteredSales = computed(() =>
  sales.value.filter(sale =>
    String(sale.sale_number)
      .toLowerCase()
      .includes(search.value.toLowerCase())
  )
)

const totalSales = computed(() =>
  sales.value.reduce((sum, sale) => sum + Number(sale.total || 0), 0)
)

const completedSales = computed(() =>
  sales.value.filter(sale => sale.status === 'completed').length
)

function formatCurrency(value: number | string | undefined) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(value || 0))
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('es-CO') : 'Sin fecha'
}

function statusLabel(status: string) {
  const statuses: Record<string, string> = {
    completed: 'Completada',
    pending: 'Pendiente',
    cancelled: 'Cancelada',
    pending_sync: 'Pendiente de sincronización'
  }

  return statuses[status] || status
}

async function loadSales() {
  isLoading.value = true
  errorMessage.value = ''
  isOffline.value = !navigator.onLine

  try {
    const result = await salesService.getAll()
    sales.value = Array.isArray(result) ? result : []
  } catch (error) {
    console.error('Error al cargar ventas:', error)
    sales.value = []
    errorMessage.value = isOffline.value
      ? 'No hay ventas guardadas para consultar sin conexión.'
      : 'No se pudieron cargar las ventas.'
  } finally {
    isLoading.value = false
  }
}

async function openSaleDetails(sale: Sale) {
  isLoadingDetail.value = true
  selectedSale.value = null

  try {
    selectedSale.value = await salesService.getById(sale.id)
  } catch (error) {
    console.error('Error al consultar el detalle de la venta:', error)
    alert('No se pudo cargar el detalle de la venta.')
  } finally {
    isLoadingDetail.value = false
  }
}

function closeSaleDetails() {
  selectedSale.value = null
}

function handleConnectionChange() {
  isOffline.value = !navigator.onLine
  loadSales()
}

onMounted(() => {
  loadSales()

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
        <h2>Historial de ventas</h2>
        <p>Consulta las ventas realizadas y sus valores.</p>
      </div>
    </div>

    <div v-if="isOffline" class="demo-notice">
      Estás trabajando sin conexión. Se muestran las ventas guardadas localmente.
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
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
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="isLoading">
              <td colspan="6">Cargando ventas...</td>
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
                {{ (sale.items || []).reduce((sum, item) => sum + Number(item.quantity), 0) }}
                unidades
              </td>

              <td>{{ formatCurrency(sale.total) }}</td>

              <td>
                <span
                  class="status-pill"
                  :class="sale.status === 'completed' ? 'ready' : 'pending'"
                >
                  {{ statusLabel(sale.status) }}
                </span>
              </td>

              <td>
                <button
                  class="detail-button"
                  @click="openSaleDetails(sale)"
                >
                  Ver detalle
                </button>
              </td>
            </tr>

            <tr v-if="!isLoading && filteredSales.length === 0">
              <td colspan="6" class="empty-state">
                No hay ventas para mostrar.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="demo-notice">
      Las ventas se consultan desde PostgreSQL y se almacenan localmente
      para permitir su consulta sin conexión.
    </p>

    <div
      v-if="selectedSale || isLoadingDetail"
      class="modal-overlay"
      @click.self="closeSaleDetails"
    >
      <div class="sale-detail-modal">
        <div class="modal-header">
          <div>
            <h2>Detalle de venta</h2>
            <p v-if="selectedSale">
              Venta #{{ selectedSale.sale_number }}
            </p>
          </div>

          <button
            class="close-button"
            @click="closeSaleDetails"
          >
            ×
          </button>
        </div>

        <div v-if="isLoadingDetail" class="detail-loading">
          Cargando información de la venta...
        </div>

        <div v-else-if="selectedSale" class="modal-content">
          <div class="detail-info-grid">
            <div>
              <span>Fecha de venta</span>
              <strong>{{ formatDate(selectedSale.created_at) }}</strong>
            </div>

            <div>
              <span>Estado</span>
              <strong>{{ statusLabel(selectedSale.status) }}</strong>
            </div>
          </div>

          <h3>Productos vendidos</h3>

          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Subtotal</th>
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="item in selectedSale.items || []"
                  :key="item.id"
                >
                  <td>{{ item.name }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ formatCurrency(item.price) }}</td>
                  <td>{{ formatCurrency(item.subtotal) }}</td>
                </tr>

                <tr v-if="!selectedSale.items || selectedSale.items.length === 0">
                  <td colspan="4">
                    No hay productos registrados en esta venta.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Información del pago</h3>

          <div
            v-for="payment in selectedSale.payments || []"
            :key="payment.id"
            class="payment-detail"
          >
            <div>
              <span>Medio de pago</span>
              <strong>{{ payment.method || 'No especificado' }}</strong>
            </div>

            <div>
              <span>Valor pagado</span>
              <strong>{{ formatCurrency(payment.amount) }}</strong>
            </div>

            <div>
              <span>Estado del pago</span>
              <strong>{{ statusLabel(payment.status) }}</strong>
            </div>

            <div>
              <span>Referencia</span>
              <strong>{{ payment.reference || 'No aplica' }}</strong>
            </div>
          </div>

          <p v-if="!selectedSale.payments || selectedSale.payments.length === 0" class="empty-payment">
            No hay información de pagos disponible.
          </p>

          <div class="sale-totals">
            <div>
              <span>Subtotal</span>
              <strong>{{ formatCurrency(selectedSale.subtotal) }}</strong>
            </div>

            <div>
              <span>Impuestos</span>
              <strong>{{ formatCurrency(selectedSale.tax) }}</strong>
            </div>

            <div>
              <span>Descuento</span>
              <strong>{{ formatCurrency(selectedSale.discount) }}</strong>
            </div>

            <div class="final-total">
              <span>Total pagado</span>
              <strong>{{ formatCurrency(selectedSale.total) }}</strong>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button
            class="detail-button"
            @click="closeSaleDetails"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-button {
  background: #e97836;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 9px 14px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.detail-button:hover {
  background: #d96628;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  z-index: 1000;
}

.sale-detail-modal {
  background: white;
  width: 100%;
  max-width: 850px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 14px;
  box-shadow: 0 15px 45px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22px 26px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 21px;
}

.modal-header p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 14px;
}

.close-button {
  background: transparent;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #64748b;
}

.modal-content {
  padding: 24px 26px;
}

.modal-content h3 {
  margin: 25px 0 14px;
  font-size: 16px;
  color: #1e293b;
}

.detail-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.detail-info-grid div,
.payment-detail div {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.detail-info-grid span,
.payment-detail span,
.sale-totals span {
  color: #64748b;
  font-size: 13px;
}

.detail-info-grid strong,
.payment-detail strong {
  color: #1e293b;
  font-size: 14px;
}

.payment-detail {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
  padding: 18px;
  background: #f8fafc;
  border-radius: 10px;
}

.sale-totals {
  margin-top: 25px;
  padding-top: 18px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sale-totals div {
  display: flex;
  justify-content: space-between;
  gap: 15px;
}

.sale-totals strong {
  color: #1e293b;
}

.sale-totals .final-total {
  padding-top: 14px;
  border-top: 1px solid #e5e7eb;
  font-size: 18px;
}

.final-total strong {
  color: #15945b;
  font-size: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 26px;
  border-top: 1px solid #e5e7eb;
}

.detail-loading,
.empty-payment {
  padding: 25px;
  text-align: center;
  color: #64748b;
}

@media (max-width: 600px) {
  .detail-info-grid,
  .payment-detail {
    grid-template-columns: 1fr;
  }

  .modal-content,
  .modal-header {
    padding: 18px;
  }
}
</style>