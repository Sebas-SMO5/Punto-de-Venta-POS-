<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../services/api'

interface Product {
  id: number
  category_id: number
  name: string
  description: string
  category: string
  price: number | string
  available: boolean
  current_stock: number | string
  minimum_stock: number | string
}

interface Category {
  id: number
  name: string
  active: boolean
}

const products = ref<Product[]>([])
const categories = ref<Category[]>([])

const search = ref('')
const selectedCategory = ref('Todas')
const showForm = ref(false)
const editingId = ref<number | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)

const form = ref({
  name: '',
  category: '',
  price: 0,
  current_stock: 0,
  minimum_stock: 0,
  available: true,
})

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

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

async function loadProducts() {
  isLoading.value = true

  try {
    const [productsResponse, categoriesResponse] = await Promise.all([
      api.get<Product[]>('/products'),
      api.get<Category[]>('/categories'),
    ])

    products.value = productsResponse.data.map((product) => ({
      ...product,
      price: Number(product.price),
      current_stock: Number(product.current_stock ?? 0),
      minimum_stock: Number(product.minimum_stock ?? 0),
    }))

    categories.value = categoriesResponse.data.filter(
      (category) => category.active,
    )

    if (
      !categories.value.some(
        (category) => category.name === form.value.category,
      )
    ) {
      form.value.category = categories.value[0]?.name || ''
    }
  } catch (error) {
    console.error('Error al cargar productos:', error)
    alert('No se pudieron cargar los productos.')
  } finally {
    isLoading.value = false
  }
}

function openCreateForm() {
  if (categories.value.length === 0) {
    alert('Primero debes registrar una categoría.')
    return
  }

  editingId.value = null

  form.value = {
    name: '',
    category: categories.value[0]?.name || '',
    price: 0,
    current_stock: 0,
    minimum_stock: 0,
    available: true,
  }

  showForm.value = true
}

function editProduct(product: Product) {
  editingId.value = product.id

  form.value = {
    name: product.name,
    category: product.category,
    price: Number(product.price),
    current_stock: Number(product.current_stock),
    minimum_stock: Number(product.minimum_stock),
    available: product.available,
  }

  showForm.value = true
}

async function saveProduct() {
  const name = form.value.name.trim()
  const price = Number(form.value.price)
  const currentStock = Number(form.value.current_stock)
  const minimumStock = Number(form.value.minimum_stock)

  if (
    !name ||
    !form.value.category ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isFinite(minimumStock) ||
    minimumStock < 0 ||
    !Number.isFinite(currentStock) ||
    currentStock < 0
  ) {
    alert('Completa los campos correctamente. Los valores de stock no pueden ser negativos.')
    return
  }

  const data = {
    name,
    category: form.value.category,
    price,
    minimum_stock: minimumStock,
    available: form.value.available,
  }

  isSaving.value = true

  try {
    if (editingId.value !== null) {
      await api.put(`/products/${editingId.value}`, data)
    } else {
      await api.post('/products', {
        ...data,
        current_stock: currentStock,
      })
    }

    showForm.value = false
    await loadProducts()

    alert('Producto guardado correctamente.')
  } catch (error: any) {
    console.error('Error al guardar producto:', error)
    alert(error.response?.data?.mensaje || 'No se pudo guardar el producto.')
  } finally {
    isSaving.value = false
  }
}

async function deleteProduct(id: number) {
  const confirmed = window.confirm(
    '¿Deseas desactivar este producto?',
  )

  if (!confirmed) return

  try {
    await api.delete(`/products/${id}`)
    await loadProducts()
    alert('Producto desactivado correctamente.')
  } catch (error: any) {
    console.error('Error al eliminar producto:', error)
    alert(error.response?.data?.mensaje || 'No se pudo desactivar el producto.')
  }
}

onMounted(loadProducts)
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Productos del restaurante</h2>
        <p>Administra los platos, bebidas y existencias del menú.</p>
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
          <option value="Todas">Todas</option>

          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.name"
          >
            {{ category.name }}
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
              <th>Stock actual</th>
              <th>Stock mínimo</th>
              <th>Disponibilidad</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="isLoading">
              <td colspan="7">Cargando productos...</td>
            </tr>

            <tr
              v-for="product in filteredProducts"
              :key="product.id"
            >
              <td>
                <strong>{{ product.name }}</strong>
              </td>

              <td>{{ product.category }}</td>

              <td>{{ formatCurrency(product.price) }}</td>

              <td>{{ product.current_stock }}</td>

              <td>{{ product.minimum_stock }}</td>

              <td>
                <span
                  class="status-pill"
                  :class="product.available ? 'ready' : 'pending'"
                >
                  {{ product.available ? 'Disponible' : 'No disponible' }}
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

            <tr v-if="!isLoading && filteredProducts.length === 0">
              <td colspan="7">No se encontraron productos.</td>
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
          required
        >
          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.name"
          >
            {{ category.name }}
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

        <label for="product-current-stock">Stock actual</label>

        <input
          id="product-current-stock"
          v-model.number="form.current_stock"
          class="search-input"
          type="number"
          min="0"
          step="0.01"
          required
          :disabled="editingId !== null"
        />

        <small v-if="editingId !== null">
          El stock actual no se modifica desde la edición del producto.
        </small>

        <label for="product-minimum-stock">Stock mínimo</label>

        <input
          id="product-minimum-stock"
          v-model.number="form.minimum_stock"
          class="search-input"
          type="number"
          min="0"
          step="0.01"
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

          <button
            type="submit"
            class="primary-button"
            :disabled="isSaving"
          >
            {{ isSaving ? 'Guardando...' : 'Guardar producto' }}
          </button>
        </div>
      </form>
    </div>

    <p class="demo-notice">
      Los productos y sus existencias se consultan y almacenan en PostgreSQL.
    </p>
  </div>
</template>