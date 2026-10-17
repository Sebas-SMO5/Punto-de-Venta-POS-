<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProductsStore } from '../stores/products'
import { useOrdersStore } from '../stores/orders'

interface CartItem {
  productId: number
  name: string
  price: number
  quantity: number
}

const productsStore = useProductsStore()
const ordersStore = useOrdersStore()

const categories = [
  'Todos',
  'Platos fuertes',
  'Acompañamientos',
  'Bebidas',
  'Postres',
]

const selectedCategory = ref('Todos')
const search = ref('')
const selectedTable = ref('1')
const cart = ref<CartItem[]>([])

const products = computed(() =>
  productsStore.products.filter((product) => product.available),
)

const filteredProducts = computed(() =>
  products.value.filter((product) => {
    const matchesCategory =
      selectedCategory.value === 'Todos' ||
      product.category === selectedCategory.value

    const matchesSearch = product.name
      .toLowerCase()
      .includes(search.value.toLowerCase())

    return matchesCategory && matchesSearch
  }),
)

const total = computed(() =>
  cart.value.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  ),
)

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function addProduct(product: {
  id: number
  name: string
  price: number
}) {
  const existing = cart.value.find(
    (item) => item.productId === product.id,
  )

  if (existing) {
    existing.quantity++
  } else {
    cart.value.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
    })
  }
}

function changeQuantity(productId: number, amount: number) {
  const item = cart.value.find(
    (entry) => entry.productId === productId,
  )

  if (!item) return

  item.quantity += amount

  if (item.quantity <= 0) {
    cart.value = cart.value.filter(
      (entry) => entry.productId !== productId,
    )
  }
}

function createOrder() {
  if (cart.value.length === 0) {
    alert('Agrega al menos un producto al pedido.')
    return
  }

  const tableNumber = Number(selectedTable.value)

  const order = ordersStore.createOrder(
    tableNumber,
    cart.value.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
  )

  alert(
    `¡Pedido #${order.id} creado correctamente!\nMesa: ${order.tableNumber}\nTotal: ${formatCurrency(order.total)}`,
  )

  cart.value = []
}
</script>

<template>
  <div class="sales-page">
    <div class="page-title-row">
      <div>
        <h2>Punto de venta</h2>
        <p>Selecciona los platos para crear un pedido.</p>
      </div>
    </div>

    <div class="sales-layout">
      <section class="panel menu-panel">
        <input
          v-model="search"
          class="search-input"
          placeholder="Buscar un plato..."
          aria-label="Buscar platos"
        />

        <div class="category-list">
          <button
            v-for="category in categories"
            :key="category"
            class="category-button"
            :class="{ selected: selectedCategory === category }"
            @click="selectedCategory = category"
          >
            {{ category }}
          </button>
        </div>

        <div class="products-grid">
          <article
            v-for="product in filteredProducts"
            :key="product.id"
            class="product-card"
          >
            <div class="product-placeholder">🍽️</div>

            <div class="product-info">
              <h3>{{ product.name }}</h3>
              <p>{{ product.category }}</p>
              <strong>{{ formatCurrency(product.price) }}</strong>
            </div>

            <button
              class="add-button"
              :aria-label="`Agregar ${product.name}`"
              @click="addProduct(product)"
            >
              +
            </button>
          </article>

          <p v-if="filteredProducts.length === 0" class="empty-message">
            No hay productos disponibles en esta categoría.
          </p>
        </div>
      </section>

      <aside class="panel cart-panel">
        <div class="panel-heading">
          <div>
            <h3>Pedido actual</h3>
            <p>{{ cart.length }} tipos de productos</p>
          </div>
        </div>

        <label class="field-label" for="table-select">Mesa</label>

        <select
          id="table-select"
          v-model="selectedTable"
          class="search-input"
        >
          <option
            v-for="number in 8"
            :key="number"
            :value="String(number)"
          >
            Mesa {{ number }}
          </option>
        </select>

        <div v-if="cart.length === 0" class="cart-empty">
          <span>🛒</span>
          <p>Tu pedido está vacío.</p>
          <small>Agrega platos desde el menú.</small>
        </div>

        <div v-else class="cart-items">
          <article
            v-for="item in cart"
            :key="item.productId"
            class="cart-item"
          >
            <div class="cart-item-info">
              <strong>{{ item.name }}</strong>
              <small>{{ formatCurrency(item.price) }}</small>
            </div>

            <div class="quantity-control">
              <button
                type="button"
                @click="changeQuantity(item.productId, -1)"
              >
                −
              </button>

              <span>{{ item.quantity }}</span>

              <button
                type="button"
                @click="changeQuantity(item.productId, 1)"
              >
                +
              </button>
            </div>
          </article>
        </div>

        <div class="cart-summary">
          <div>
            <span>Total</span>
            <strong>{{ formatCurrency(total) }}</strong>
          </div>

          <button
            class="primary-button checkout-button"
            @click="createOrder"
          >
            Crear pedido
          </button>

          <p class="demo-notice">
            Los pedidos se guardan localmente en este navegador.
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>