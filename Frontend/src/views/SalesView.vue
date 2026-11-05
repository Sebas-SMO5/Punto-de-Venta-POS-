<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { productsService } from '../services/products.service'
import { tablesService, type RestaurantTable } from '../services/tables.service'
import { ordersService } from '../services/orders.service'
import type { Product } from '../stores/products'
import type { OrderItem } from '../stores/orders'

interface CartItem extends OrderItem {
  subtotal: number
}

const products = ref<Product[]>([])
const tables = ref<RestaurantTable[]>([])
const cart = ref<CartItem[]>([])
const selectedTable = ref<number | null>(null)
const search = ref('')
const selectedCategory = ref('Todas')
const isLoading = ref(false)
const isSaving = ref(false)
const isOffline = ref(!navigator.onLine)
const message = ref('')
const errorMessage = ref('')

const categories = computed(() => [
  'Todas',
  ...new Set(products.value.map(product => product.category).filter(Boolean))
])

const filteredProducts = computed(() =>
  products.value.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(search.value.toLowerCase())
    const matchesCategory = selectedCategory.value === 'Todas' || product.category === selectedCategory.value
    return product.available && matchesSearch && matchesCategory
  })
)

const total = computed(() =>
  cart.value.reduce((sum, item) => sum + item.subtotal, 0)
)

const itemCount = computed(() =>
  cart.value.reduce((sum, item) => sum + item.quantity, 0)
)

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(value)
}

function updateConnection() {
  isOffline.value = !navigator.onLine
}

async function loadData() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const [loadedProducts, loadedTables] = await Promise.all([
      productsService.getAll(),
      tablesService.getAll()
    ])

    products.value = loadedProducts
    tables.value = loadedTables.filter(table => table.active)
    
if (selectedTable.value === null && tables.value.length > 0) {
  const firstTable = tables.value[0]

  if (firstTable) {
    selectedTable.value = firstTable.id
  }
}

  } catch {
    errorMessage.value = 'No fue posible cargar los productos y las mesas. Verifica que existan datos guardados para trabajar sin conexión.'
  } finally {
    isLoading.value = false
  }
}

function addToCart(product: Product) {
  const existing = cart.value.find(item => item.productId === product.id)

  if (existing) {
    existing.quantity += 1
    existing.subtotal = existing.price * existing.quantity
    return
  }

  cart.value.push({
    productId: product.id,
    name: product.name,
    price: Number(product.price),
    quantity: 1,
    subtotal: Number(product.price)
  })
}

function changeQuantity(item: CartItem, amount: number) {
  item.quantity += amount

  if (item.quantity <= 0) {
    cart.value = cart.value.filter(cartItem => cartItem.productId !== item.productId)
    return
  }

  item.subtotal = item.price * item.quantity
}

function clearCart() {
  cart.value = []
  message.value = ''
}

async function createOrder() {
  if (selectedTable.value === null) {
    errorMessage.value = 'Selecciona una mesa para continuar.'
    return
  }

  if (!cart.value.length) {
    errorMessage.value = 'Agrega al menos un producto al pedido.'
    return
  }

  isSaving.value = true
  errorMessage.value = ''
  message.value = ''

  try {
    const items: OrderItem[] = cart.value.map(item => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    }))

    const order = await ordersService.create(selectedTable.value, items)

    message.value = isOffline.value
      ? `Pedido guardado localmente (pendiente de sincronización). Código local: ${order.id}`
      : `Pedido ${order.id} registrado correctamente.`

    cart.value = []
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'No fue posible registrar el pedido.'
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  window.addEventListener('online', updateConnection)
  window.addEventListener('offline', updateConnection)
  loadData()
})

onUnmounted(() => {
  window.removeEventListener('online', updateConnection)
  window.removeEventListener('offline', updateConnection)
})
</script>

<template>
  <section class="sales-page">
    <header class="page-header">
      <div>
        <h1>Punto de venta</h1>
        <p>Selecciona los productos, arma el pedido y asígnalo a una mesa.</p>
      </div>

      <span class="connection-badge" :class="{ offline: isOffline }">
        <span class="connection-dot"></span>
        {{ isOffline ? 'Modo sin conexión' : 'Conectado' }}
      </span>
    </header>

    <div v-if="message" class="feedback success">{{ message }}</div>
    <div v-if="errorMessage" class="feedback error">{{ errorMessage }}</div>

    <div class="sales-layout">
      <main class="catalog-panel">
        <div class="catalog-toolbar">
          <input v-model="search" type="search" placeholder="Buscar producto..." />

          <select v-model="selectedCategory">
            <option v-for="category in categories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </div>

        <div v-if="isLoading" class="empty-state">
          Cargando productos...
        </div>

        <div v-else-if="!filteredProducts.length" class="empty-state">
          No hay productos disponibles para mostrar.
        </div>

        <div v-else class="product-grid">
          <button
            v-for="product in filteredProducts"
            :key="product.id"
            class="product-option"
            type="button"
            @click="addToCart(product)"
          >
            <span class="product-category">
              {{ product.category || 'Producto' }}
            </span>

            <strong>{{ product.name }}</strong>

            <span class="product-price">
              {{ formatCurrency(Number(product.price)) }}
            </span>

            <span class="add-label">+ Agregar</span>
          </button>
        </div>
      </main>

      <aside class="cart-panel">
        <div class="cart-heading">
          <div>
            <h2>Pedido actual</h2>
            <p>
              {{ itemCount }}
              {{ itemCount === 1 ? 'producto' : 'productos' }}
            </p>
          </div>

          <button
            class="clear-button"
            type="button"
            :disabled="!cart.length"
            @click="clearCart"
          >
            Limpiar
          </button>
        </div>

        <label class="table-field">
          Mesa

          <select v-model="selectedTable">
            <option :value="null" disabled>
              Selecciona una mesa
            </option>

            <option
              v-for="table in tables"
              :key="table.id"
              :value="table.id"
            >
              Mesa {{ table.table_number }} · {{ table.capacity }} puestos
            </option>
          </select>
        </label>

        <div v-if="!cart.length" class="cart-empty">
          <span class="cart-empty-icon">＋</span>
          <strong>Tu pedido está vacío</strong>
          <p>Selecciona productos del catálogo para agregarlos.</p>
        </div>

        <div v-else class="cart-items">
          <article
            v-for="item in cart"
            :key="item.productId"
            class="cart-item"
          >
            <div class="cart-item-info">
              <strong>{{ item.name }}</strong>
              <span>{{ formatCurrency(item.price) }} c/u</span>
            </div>

            <div class="quantity-control">
              <button type="button" @click="changeQuantity(item, -1)">
                −
              </button>

              <span>{{ item.quantity }}</span>

              <button type="button" @click="changeQuantity(item, 1)">
                +
              </button>
            </div>

            <strong class="item-subtotal">
              {{ formatCurrency(item.subtotal) }}
            </strong>
          </article>
        </div>

        <div class="cart-summary">
          <div>
            <span>Subtotal</span>
            <strong>{{ formatCurrency(total) }}</strong>
          </div>

          <div class="grand-total">
            <span>Total</span>
            <strong>{{ formatCurrency(total) }}</strong>
          </div>

          <button
            class="submit-order"
            type="button"
            :disabled="isSaving || !cart.length || selectedTable === null"
            @click="createOrder"
          >
            {{
              isSaving
                ? 'Guardando pedido...'
                : isOffline
                  ? 'Guardar pedido sin conexión'
                  : 'Crear pedido'
            }}
          </button>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.sales-page{display:flex;flex-direction:column;gap:22px;color:#26332d}.page-header{display:flex;justify-content:space-between;align-items:center;gap:16px}.page-header h1{margin:0;font-size:26px;font-weight:700}.page-header p{margin:7px 0 0;color:#7b827e;font-size:14px}.connection-badge{display:flex;align-items:center;gap:8px;padding:9px 13px;border-radius:20px;background:#e8f5ed;color:#267044;font-size:12px;font-weight:600;white-space:nowrap}.connection-badge.offline{background:#fff2df;color:#9a641d}.connection-dot{width:8px;height:8px;border-radius:50%;background:#35a866}.offline .connection-dot{background:#d99435}.feedback{padding:12px 15px;border-radius:9px;font-size:13px}.success{background:#e8f5ed;color:#267044}.error{background:#fff0ed;color:#b54735}.sales-layout{display:grid;grid-template-columns:minmax(0,1fr) 370px;gap:20px;align-items:start}.catalog-panel,.cart-panel{background:#fff;border:1px solid #e8eae7;border-radius:14px;padding:20px;box-shadow:0 2px 8px #26332d08}.catalog-toolbar{display:flex;gap:12px;margin-bottom:18px}.catalog-toolbar input,.catalog-toolbar select,.table-field select{height:42px;border:1px solid #e1e5e1;border-radius:8px;padding:0 12px;background:#fff;color:#26332d;outline:none}.catalog-toolbar input{flex:1;min-width:0}.catalog-toolbar select{width:180px}.product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}.product-option{min-height:150px;text-align:left;display:flex;flex-direction:column;align-items:flex-start;gap:9px;padding:15px;border:1px solid #e7eae6;border-radius:11px;background:#fff;cursor:pointer;transition:.15s}.product-option:hover{border-color:#c96f4a;transform:translateY(-2px);box-shadow:0 5px 15px #26332d0d}.product-category{font-size:11px;color:#858d87}.product-option strong{font-size:14px}.product-price{font-weight:700;color:#26332d}.add-label{margin-top:auto;color:#c96f4a;font-size:12px;font-weight:700}.cart-panel{position:sticky;top:20px;display:flex;flex-direction:column;min-height:510px}.cart-heading{display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:1px solid #edf0ec}.cart-heading h2{margin:0;font-size:18px}.cart-heading p{margin:5px 0 0;color:#858d87;font-size:12px}.clear-button{border:0;background:transparent;color:#c96f4a;font-weight:600;cursor:pointer}.clear-button:disabled{opacity:.4;cursor:not-allowed}.table-field{display:flex;flex-direction:column;gap:8px;margin:17px 0;font-size:13px;font-weight:600}.table-field select{width:100%}.cart-empty{flex:1;min-height:210px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#858d87}.cart-empty-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#f8eee9;color:#c96f4a;font-size:25px}.cart-empty strong{margin-top:12px;color:#4b554e;font-size:14px}.cart-empty p{max-width:220px;font-size:12px;line-height:1.5}.cart-items{display:flex;flex-direction:column;gap:14px;max-height:350px;overflow:auto}.cart-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding-bottom:13px;border-bottom:1px solid #f0f1ef}.cart-item-info{display:flex;flex-direction:column;gap:5px;min-width:0}.cart-item-info strong{font-size:13px}.cart-item-info span{font-size:11px;color:#858d87}.quantity-control{display:flex;align-items:center;gap:9px}.quantity-control button{width:25px;height:25px;border:1px solid #e3e6e2;border-radius:6px;background:#fff;cursor:pointer}.quantity-control span{font-size:12px;font-weight:600}.item-subtotal{grid-column:1/-1;text-align:right;font-size:12px}.cart-summary{margin-top:auto;padding-top:18px}.cart-summary>div{display:flex;justify-content:space-between;margin-bottom:12px;font-size:13px;color:#737c75}.cart-summary .grand-total{padding-top:13px;border-top:1px solid #e9ece8;color:#26332d;font-size:16px}.grand-total strong{font-size:19px}.submit-order{width:100%;height:46px;margin-top:7px;border:0;border-radius:9px;background:#c96f4a;color:#fff;font-weight:700;cursor:pointer}.submit-order:disabled{opacity:.5;cursor:not-allowed}.empty-state{padding:50px 15px;text-align:center;color:#858d87;font-size:13px}@media(max-width:1000px){.sales-layout{grid-template-columns:1fr}.cart-panel{position:static;min-height:420px}}@media(max-width:560px){.page-header{align-items:flex-start;flex-direction:column}.catalog-toolbar{flex-direction:column}.catalog-toolbar select{width:100%}.product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>