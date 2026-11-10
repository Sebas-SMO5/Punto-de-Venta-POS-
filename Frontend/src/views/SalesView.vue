<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api } from '../services/api'
import { ordersService } from '../services/orders.service'
import { productsService } from '../services/products.service'
import { tablesService, type RestaurantTable } from '../services/tables.service'
import { getLocalData, saveLocalData } from '../offline/db'
import { addOperation } from '../offline/queue'

interface OrderItem {
  id: number
  productId: number
  name: string
  quantity: number
  price: number
  subtotal: number
}

interface Order {
  id: number
  order_number: string
  table_id: number
  table_number: number | null
  items: OrderItem[]
  notes: string
  total: number
  status: string
  created_at: string
}

interface Sale {
  id: number
  order_id: number
  sale_number: string
  created_at?: string
  total?: number
  status?: string
  items?: OrderItem[]
  payments?: {
    id: number
    amount: number
    status: string
    method: string
    reference: string | null
  }[]
  pendingSync?: boolean
}

const orders = ref<Order[]>([])
const sales = ref<Sale[]>([])
const isLoading = ref(false)
const isRegistering = ref(false)
const selectedOrder = ref<Order | null>(null)
const selectedPaymentMethod = ref(1)
const isOffline = ref(!navigator.onLine)
const showOrderModal = ref(false)
const isCreatingOrder = ref(false)
const availableProducts = ref<any[]>([])
const availableTables = ref<RestaurantTable[]>([])
const selectedTableId = ref<number | null>(null)
const orderNotes = ref('')
const orderCart = ref<{ productId: number; name: string; price: number; quantity: number }[]>([])

const paymentMethods = [
  { id: 1, name: 'Efectivo' },
  { id: 2, name: 'Tarjeta' },
  { id: 3, name: 'Transferencia' },
  { id: 4, name: 'Nequi' },
  { id: 5, name: 'Daviplata' }
]

const sortedOrders = computed(() =>
  [...orders.value].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  )
)

const pendingCount = computed(() =>
  orders.value.filter(order =>
    ['pending', 'preparing', 'ready'].includes(order.status)
  ).length
)

const completedCount = computed(() =>
  orders.value.filter(order => order.status === 'completed').length
)

const newOrderTotal = computed(() =>
  orderCart.value.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  )
)

async function openOrderModal() {
  try {
    const [products, tables] = await Promise.all([
      productsService.getAll(),
      tablesService.getAll()
    ])

    availableProducts.value = products.filter((product: any) =>
      product.available !== false && product.active !== false
    )

    availableTables.value = tables.filter(table =>
      table.active !== false
    )

    if (availableTables.value.length === 0) {
      alert('No hay mesas activas disponibles.')
      return
    }

    if (availableProducts.value.length === 0) {
      alert('No hay productos disponibles para registrar el pedido.')
      return
    }

const primeraMesa = availableTables.value[0]

if (!primeraMesa) {
  alert('No hay mesas disponibles para registrar el pedido.')
  return
}

selectedTableId.value = primeraMesa.id

    orderCart.value = []
    orderNotes.value = ''
    showOrderModal.value = true
  } catch (error) {
    console.error('Error al preparar el nuevo pedido:', error)
    alert('No se pudieron cargar los productos o las mesas.')
  }
}

function addProductToCart(product: any) {
  const existing = orderCart.value.find(
    item => item.productId === Number(product.id)
  )

  if (existing) {
    existing.quantity += 1
    return
  }

  orderCart.value.push({
    productId: Number(product.id),
    name: product.name,
    price: Number(product.price),
    quantity: 1
  })
}

function changeCartQuantity(productId: number, amount: number) {
  const item = orderCart.value.find(
    product => product.productId === productId
  )

  if (!item) return

  item.quantity += amount

  if (item.quantity <= 0) {
    orderCart.value = orderCart.value.filter(
      product => product.productId !== productId
    )
  }
}

async function createNewOrder() {
  if (!selectedTableId.value) {
    alert('Selecciona una mesa.')
    return
  }

  if (orderCart.value.length === 0) {
    alert('Agrega al menos un producto al pedido.')
    return
  }

  isCreatingOrder.value = true

  try {
    const tableId = selectedTableId.value
    const table = availableTables.value.find(
      item => Number(item.id) === Number(tableId)
    )

    const cartItems = orderCart.value.map(item => ({
      ...item
    }))

    const total = newOrderTotal.value
    const notes = orderNotes.value

    const createdOrder = await ordersService.create(
      tableId,
      cartItems as any,
      notes
    )

    const localId = Number(createdOrder.id)

    const newOrder: Order = {
      id: localId,
      order_number:
        (createdOrder as any).order_number ||
        `PED-${String(Math.abs(localId)).padStart(6, '0')}`,
      table_id: tableId,
      table_number: table?.table_number ?? tableId,
      items: cartItems.map((item, index) => ({
        id: index + 1,
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity
      })),
      notes,
      total,
      status: 'pending',
      created_at: new Date().toISOString()
    }

    if (!orders.value.some(order => order.id === newOrder.id)) {
      orders.value.unshift(newOrder)
    }

    showOrderModal.value = false
    orderCart.value = []
    orderNotes.value = ''

    if (navigator.onLine) {
      await loadOrders()
    }

    alert(
      `Pedido registrado correctamente.\n\nPedido: ${newOrder.order_number}\nMesa: ${newOrder.table_number}\nTotal: ${formatCurrency(total)}`
    )
  } catch (error: any) {
    console.error('Error al crear pedido:', error)
    alert(
      error.response?.data?.mensaje ||
      error.response?.data?.message ||
      error.message ||
      'No se pudo registrar el pedido.'
    )
  } finally {
    isCreatingOrder.value = false
  }
}

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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    preparing: 'En preparación',
    ready: 'Listo',
    completed: 'Entregado',
    cancelled: 'Cancelado',
    pending_sync: 'Pendiente de sincronización'
  }

  return labels[status] || status
}

function hasSale(orderId: number) {
  return sales.value.some(sale =>
    Number(sale.order_id) === orderId
  )
}

async function loadOrders() {
  isLoading.value = true

  try {
    const response = await ordersService.getAll()

    orders.value = response.map((order: any) => ({
      id: Number(order.id),
      order_number: order.order_number || `PED-${order.id}`,
      table_id: Number(order.table_id ?? order.tableNumber ?? 0),
      table_number: order.table_number ?? order.tableNumber ?? null,
      items: (order.items || []).map((item: any) => ({
        id: Number(item.id ?? item.productId ?? item.product_id ?? 0),
        productId: Number(item.productId ?? item.product_id ?? 0),
        name: item.name || item.product_name || 'Producto',
        quantity: Number(item.quantity || 0),
        price: Number(item.price ?? item.unit_price ?? 0),
        subtotal: Number(
          item.subtotal ??
          (Number(item.price ?? item.unit_price ?? 0) *
            Number(item.quantity || 0))
        )
      })),
      notes: order.notes || '',
      total: Number(order.total || 0),
      status: ({
        'Pendiente': 'pending',
        'En preparación': 'preparing',
        'Listo': 'ready',
        'Entregado': 'completed',
        'Cancelado': 'cancelled'
      } as Record<string, string>)[order.status] || order.status,
      created_at: order.created_at || order.createdAt || new Date().toISOString()
    }))
  } catch (error) {
    console.error('Error al cargar pedidos:', error)
    alert('No se pudieron cargar los pedidos.')
  } finally {
    isLoading.value = false
  }
}

async function loadSales() {
  try {
    if (!navigator.onLine) {
      sales.value = await getLocalData('sales') as unknown as Sale[]
      return
    }

    const response = await api.get<Sale[]>('/sales')
    const serverSales = response.data

    const localSales = await getLocalData('sales') as unknown as Sale[]

    const pendingSales = localSales.filter(sale =>
      sale.pendingSync === true
    )

    const combinedSales = [
      ...serverSales,
      ...pendingSales.filter(localSale =>
        !serverSales.some(serverSale =>
          Number(serverSale.order_id) === Number(localSale.order_id)
        )
      )
    ]

    sales.value = combinedSales

    for (const sale of serverSales) {
      await saveLocalData(
        'sales',
        sale as unknown as Record<string, unknown> & { id: number }
      )
    }
  } catch (error) {
    console.error('Error al cargar ventas:', error)
    sales.value = await getLocalData('sales') as unknown as Sale[]
  }
}

async function updateStatus(
  id: number,
  status: 'completed' | 'cancelled'
) {
  if (!navigator.onLine) {
    alert('Necesitas conexión a internet para actualizar el estado del pedido.')
    return
  }

  const message = status === 'completed'
    ? '¿Marcar este pedido como entregado?'
    : '¿Cancelar este pedido?'

  if (!window.confirm(message)) return

  try {
    if (status === 'cancelled') {
      await api.delete(`/orders/${id}`)
    } else {
      await api.patch(`/orders/${id}/status`, { status })
    }

    await loadOrders()
    alert('Pedido actualizado correctamente.')
  } catch (error: any) {
    console.error('Error al actualizar pedido:', error)
    alert(error.response?.data?.mensaje || 'No se pudo actualizar el pedido.')
  }
}

function openSaleModal(order: Order) {
  if (hasSale(order.id)) {
    alert('Este pedido ya tiene una venta registrada.')
    return
  }

  selectedOrder.value = order
  selectedPaymentMethod.value = 1
}

function closeSaleModal() {
  if (isRegistering.value) return
  selectedOrder.value = null
}

async function registerSale() {
  if (!selectedOrder.value) return

  const order = selectedOrder.value

  if (hasSale(order.id)) {
    alert('Este pedido ya tiene una venta registrada.')
    selectedOrder.value = null
    return
  }

  isRegistering.value = true

  try {
    if (navigator.onLine) {
      const response = await api.post('/sales', {
        orderId: order.id,
        paymentMethodId: selectedPaymentMethod.value,
        reference: null
      })

      const registeredSale = response.data.venta

      alert(
        `¡Venta registrada correctamente!\n\nVenta: ${registeredSale.sale_number}\nPedido: ${order.order_number}\nTotal: ${formatCurrency(order.total)}`
      )

      selectedOrder.value = null

      await Promise.all([
        loadOrders(),
        loadSales()
      ])

      return
    }

    const operationId = crypto.randomUUID()
    const localSaleId = -Date.now()

    const paymentMethod = paymentMethods.find(
      method => method.id === selectedPaymentMethod.value
    )

    const localSale: Sale = {
      id: localSaleId,
      order_id: order.id,
      sale_number: `PEND-${Math.abs(localSaleId)}`,
      created_at: new Date().toISOString(),
      total: order.total,
      status: 'pending_sync',
      pendingSync: true,
      items: order.items,
      payments: [
        {
          id: localSaleId,
          amount: order.total,
          status: 'pending_sync',
          method: paymentMethod?.name || 'No especificado',
          reference: null
        }
      ]
    }

    await saveLocalData(
      'sales',
      localSale as unknown as Record<string, unknown> & { id: number }
    )

    await addOperation({
      operationId,
      type: 'CREATE',
      entity: 'sales',
      data: {
        orderId: order.id,
        paymentMethodId: selectedPaymentMethod.value,
        reference: null,
        localSaleId,
        localOrderId: order.id
      }
    })

    sales.value.push(localSale)
    selectedOrder.value = null

    alert(
      `Venta guardada correctamente sin conexión.\n\nVenta: ${localSale.sale_number}\nPedido: ${order.order_number}\nTotal: ${formatCurrency(order.total)}\n\nSe sincronizará cuando vuelva internet.`
    )
  } catch (error: any) {
    console.error('Error al registrar venta:', error)
    alert(
      error.response?.data?.mensaje ||
      'No se pudo registrar la venta.'
    )
  } finally {
    isRegistering.value = false
  }
}

function handleConnectionChange() {
  isOffline.value = !navigator.onLine

  if (navigator.onLine) {
    loadOrders()
    loadSales()
  }
}

onMounted(async () => {
  await Promise.all([
    loadOrders(),
    loadSales()
  ])

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
        <h2>Punto de venta</h2>
        <p>Registra pedidos, consulta su estado y procesa los pagos.</p>
      </div>

      <button class="primary-button" @click="openOrderModal">
        + Nuevo pedido
      </button>
    </div>

    <div v-if="isOffline" class="demo-notice">
      Estás trabajando sin conexión. Los pedidos y las ventas nuevas se guardarán localmente.
    </div>

    <div class="stats-grid products-summary">
      <article class="stat-card">
        <p class="stat-label">Total de pedidos</p>
        <h3>{{ orders.length }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Pendientes o en preparación</p>
        <h3>{{ pendingCount }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Entregados</p>
        <h3>{{ completedCount }}</h3>
      </article>
    </div>

    <section class="panel">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Mesa</th>
              <th>Productos</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="isLoading">
              <td colspan="7">Cargando pedidos...</td>
            </tr>

            <tr v-for="order in sortedOrders" :key="order.id">
              <td>
                <strong>{{ order.order_number || order.id }}</strong>
              </td>

              <td>
                {{ order.table_number ? `Mesa ${order.table_number}` : 'Sin mesa' }}
              </td>

              <td>
                {{ order.items.reduce((sum, item) => sum + item.quantity, 0) }}
                unidades
              </td>

              <td>{{ formatDate(order.created_at) }}</td>

              <td>{{ formatCurrency(order.total) }}</td>

              <td>
                <span
                  class="status-pill"
                  :class="{
                    pending: order.status === 'pending' || order.status === 'cancelled',
                    preparing: order.status === 'preparing',
                    ready: order.status === 'ready' || order.status === 'completed'
                  }"
                >
                  {{ statusLabel(order.status) }}
                </span>
              </td>

              <td>
                <div
                  class="product-actions"
                  v-if="!['completed', 'cancelled'].includes(order.status)"
                >
                  <button
                    class="table-action"
                    @click="updateStatus(order.id, 'completed')"
                  >
                    Entregar
                  </button>

                  <button
                    class="table-action delete-action"
                    @click="updateStatus(order.id, 'cancelled')"
                  >
                    Cancelar
                  </button>
                </div>

                <div v-else-if="order.status === 'completed'">
                  <span
                    v-if="hasSale(order.id)"
                    class="status-pill ready"
                  >
                    {{ sales.find(sale => Number(sale.order_id) === order.id)?.pendingSync ? 'Pendiente de sincronización' : 'Vendido' }}
                  </span>

                  <button
                    v-else
                    class="table-action"
                    @click="openSaleModal(order)"
                  >
                    Registrar venta
                  </button>
                </div>

                <span v-else>—</span>
              </td>
            </tr>

            <tr v-if="!isLoading && orders.length === 0">
              <td colspan="7" class="empty-state">
                Todavía no hay pedidos registrados.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div
      v-if="showOrderModal"
      class="sale-modal-overlay"
      @click.self="!isCreatingOrder && (showOrderModal = false)"
    >
      <section class="panel sale-modal order-modal">
        <h3>Registrar nuevo pedido</h3>

        <label class="field-label" for="order-table">
          Mesa
        </label>

        <select
          id="order-table"
          v-model="selectedTableId"
          class="search-input"
          :disabled="isCreatingOrder"
        >
          <option
            v-for="table in availableTables"
            :key="table.id"
            :value="table.id"
          >
            Mesa {{ table.table_number }}
          </option>
        </select>

        <label class="field-label" for="order-product">
          Agregar producto
        </label>

        <select
          id="order-product"
          class="search-input"
          :disabled="isCreatingOrder"
          @change="(event: Event) => {
            const select = event.target as HTMLSelectElement
            const id = Number(select.value)
            const product = availableProducts.find(item => Number(item.id) === id)
            if (product) addProductToCart(product)
            select.value = ''
          }"
        >
          <option value="">Selecciona un producto</option>

          <option
            v-for="product in availableProducts"
            :key="product.id"
            :value="product.id"
          >
            {{ product.name }} - {{ formatCurrency(product.price) }}
          </option>
        </select>

        <div v-if="orderCart.length" class="cart-list">
          <div
            v-for="item in orderCart"
            :key="item.productId"
            class="cart-row"
          >
            <div>
              <strong>{{ item.name }}</strong>
              <small>{{ formatCurrency(item.price) }} c/u</small>
            </div>

            <div class="cart-controls">
              <button
                type="button"
                class="table-action"
                :disabled="isCreatingOrder"
                @click="changeCartQuantity(item.productId, -1)"
              >
                −
              </button>

              <strong>{{ item.quantity }}</strong>

              <button
                type="button"
                class="table-action"
                :disabled="isCreatingOrder"
                @click="changeCartQuantity(item.productId, 1)"
              >
                +
              </button>
            </div>

            <strong>
              {{ formatCurrency(item.price * item.quantity) }}
            </strong>
          </div>
        </div>

        <p v-else class="empty-state">
          Todavía no has agregado productos.
        </p>

        <label class="field-label" for="order-notes">
          Observaciones (opcional)
        </label>

        <textarea
          id="order-notes"
          v-model="orderNotes"
          class="search-input"
          rows="2"
          :disabled="isCreatingOrder"
        ></textarea>

        <div class="order-total">
          Total: {{ formatCurrency(newOrderTotal) }}
        </div>

        <div class="product-actions sale-modal-actions">
          <button
            class="table-action"
            :disabled="isCreatingOrder"
            @click="showOrderModal = false"
          >
            Cancelar
          </button>

          <button
            class="primary-button"
            :disabled="isCreatingOrder || orderCart.length === 0"
            @click="createNewOrder"
          >
            {{ isCreatingOrder ? 'Registrando...' : 'Registrar pedido' }}
          </button>
        </div>
      </section>
    </div>

    <div
      v-if="selectedOrder"
      class="sale-modal-overlay"
      @click.self="closeSaleModal"
    >
      <section class="panel sale-modal">
        <h3>Registrar venta</h3>

        <p>
          Pedido:
          <strong>{{ selectedOrder.order_number }}</strong>
        </p>

        <p>
          Total:
          <strong>{{ formatCurrency(selectedOrder.total) }}</strong>
        </p>

        <label class="field-label" for="payment-method">
          Medio de pago
        </label>

        <select
          id="payment-method"
          v-model="selectedPaymentMethod"
          class="search-input"
          :disabled="isRegistering"
        >
          <option
            v-for="method in paymentMethods"
            :key="method.id"
            :value="method.id"
          >
            {{ method.name }}
          </option>
        </select>

        <div class="product-actions sale-modal-actions">
          <button
            class="table-action"
            :disabled="isRegistering"
            @click="closeSaleModal"
          >
            Cancelar
          </button>

          <button
            class="primary-button"
            :disabled="isRegistering"
            @click="registerSale"
          >
            {{ isRegistering ? 'Registrando...' : 'Confirmar pago' }}
          </button>
        </div>
      </section>
    </div>

    <p class="demo-notice">
      Los pedidos y las ventas se almacenan localmente para permitir su consulta
      y registro sin conexión.
    </p>
  </div>
</template>

<style scoped>
.sale-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.45);
}

.sale-modal {
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
}

.order-modal .field-label {
  display: block;
  margin: 14px 0 6px;
  font-weight: 600;
}

.cart-list {
  margin-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.cart-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
}

.cart-row small {
  display: block;
  margin-top: 4px;
}

.cart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.order-total {
  margin-top: 18px;
  text-align: right;
  font-size: 18px;
  font-weight: 700;
}

.order-modal textarea {
  width: 100%;
  resize: vertical;
}

.sale-modal h3 {
  margin-top: 0;
}

.sale-modal-actions {
  justify-content: flex-end;
  margin-top: 24px;
  gap: 10px;
}

.sale-modal-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>