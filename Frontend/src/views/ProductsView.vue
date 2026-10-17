<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProductsStore, type Product } from '../stores/products'

const productsStore = useProductsStore()
const products = computed(() => productsStore.products)

const search = ref('')
const selectedCategory = ref('Todas')
const showForm = ref(false)
const editingId = ref<number | null>(null)

const form = ref({
  name: '',
  category: 'Platos fuertes',
  price: 0,
  available: true,
})

const categories = [
  'Todas',
  'Platos fuertes',
  'Acompañamientos',
  'Bebidas',
  'Postres',
]

const filteredProducts = computed(() =>
  products.value.filter((product) => {
    const matchesName = product.name
      .toLowerCase()
      .includes(search.value.toLowerCase())

    const matchesCategory =
      selectedCategory.value === 'Todas' ||
      product.category === selectedCategory.value

    return matchesName && matchesCategory
  }),
)

const availableCount = computed(
  () => products.value.filter((product) => product.available).length,
)

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function openCreateForm() {
  editingId.value = null

  form.value = {
    name: '',
    category: 'Platos fuertes',
    price: 0,
    available: true,
  }

  showForm.value = true
}

function editProduct(product: Product) {
  editingId.value = product.id

  form.value = {
    name: product.name,
    category: product.category,
    price: product.price,
    available: product.available,
  }

  showForm.value = true
}

function saveProduct() {
  const name = form.value.name.trim()
  const price = Number(form.value.price)

  if (!name || !Number.isFinite(price) || price <= 0) {
    alert('Ingresa un nombre y un precio mayor que cero.')
    return
  }

  if (editingId.value !== null) {
    const product = products.value.find(
      (item) => item.id === editingId.value,
    )

    if (product) {
      productsStore.updateProduct({
        id: product.id,
        name,
        category: form.value.category,
        price,
        available: form.value.available,
      })
    }
  } else {
    productsStore.addProduct({
      name,
      category: form.value.category,
      price,
      available: form.value.available,
    })
  }

  showForm.value = false
}

function deleteProduct(id: number) {
  const confirmed = window.confirm(
    '¿Deseas eliminar este producto?',
  )

  if (!confirmed) return

  productsStore.deleteProduct(id)
}
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Productos del restaurante</h2>
        <p>Administra los platos y las bebidas del menú.</p>
      </div>

      <button class="primary-button" @click="openCreateForm">
        + Nuevo producto
      </button>
    </div>

    <div class="stats-grid products-summary">
      <article class="stat-card">
        <p class="stat-label">Total de productos</p>
        <h3>{{ products.length }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">Productos disponibles</p>
        <h3>{{ availableCount }}</h3>
      </article>

      <article class="stat-card">
        <p class="stat-label">No disponibles</p>
        <h3>{{ products.length - availableCount }}</h3>
      </article>
    </div>

    <section class="panel">
      <div class="product-filters">
        <input
          v-model="search"
          class="search-input"
          placeholder="Buscar producto..."
          aria-label="Buscar producto"
        />

        <select
          v-model="selectedCategory"
          class="search-input category-select"
          aria-label="Filtrar por categoría"
        >
          <option
            v-for="category in categories"
            :key="category"
            :value="category"
          >
            {{ category }}
          </option>
        </select>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Disponibilidad</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="product in filteredProducts"
              :key="product.id"
            >
              <td>
                <strong>{{ product.name }}</strong>
              </td>

              <td>{{ product.category }}</td>

              <td>{{ formatCurrency(product.price) }}</td>

              <td>
                <span
                  class="status-pill"
                  :class="product.available ? 'ready' : 'pending'"
                >
                  {{ product.available ? 'Disponible' : 'Agotado' }}
                </span>
              </td>

              <td>
                <div class="product-actions">
                  <button
                    class="table-action"
                    @click="editProduct(product)"
                  >
                    Editar
                  </button>

                  <button
                    class="table-action delete-action"
                    @click="deleteProduct(product.id)"
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="filteredProducts.length === 0">
              <td colspan="5">No se encontraron productos.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div
      v-if="showForm"
      class="modal-backdrop"
      @click.self="showForm = false"
    >
      <form class="product-form" @submit.prevent="saveProduct">
        <h3>
          {{ editingId === null ? 'Nuevo producto' : 'Editar producto' }}
        </h3>

        <label for="product-name">Nombre del producto</label>

        <input
          id="product-name"
          v-model="form.name"
          class="search-input"
          required
          maxlength="100"
        />

        <label for="product-category">Categoría</label>

        <select
          id="product-category"
          v-model="form.category"
          class="search-input"
        >
          <option
            v-for="category in categories.filter((item) => item !== 'Todas')"
            :key="category"
            :value="category"
          >
            {{ category }}
          </option>
        </select>

        <label for="product-price">Precio en pesos colombianos</label>

        <input
          id="product-price"
          v-model.number="form.price"
          class="search-input"
          type="number"
          min="1"
          step="1"
          required
        />

        <label class="availability-field">
          <input v-model="form.available" type="checkbox" />
          Producto disponible para la venta
        </label>

        <div class="form-actions">
          <button
            type="button"
            class="table-action"
            @click="showForm = false"
          >
            Cancelar
          </button>

          <button type="submit" class="primary-button">
            Guardar producto
          </button>
        </div>
      </form>
    </div>

    <p class="demo-notice">
      Los productos se guardan localmente en este navegador.
      La sincronización con el servidor todavía está pendiente.
    </p>
  </div>
</template>