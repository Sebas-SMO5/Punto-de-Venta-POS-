<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../services/api'

interface Category {
  id: number
  name: string
  description: string
  active: boolean
  created_at?: string
}

const categories = ref<Category[]>([])
const search = ref('')
const showForm = ref(false)
const editingId = ref<number | null>(null)
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')

const form = ref({
  name: '',
  description: '',
  active: true
})

const filteredCategories = computed(() =>
  categories.value.filter(category =>
    category.name.toLowerCase().includes(search.value.toLowerCase())
  )
)

async function loadCategories() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.get<Category[]>('/categories')
    categories.value = response.data
  } catch (error) {
    console.error('Error al consultar categorías:', error)
    errorMessage.value = 'No fue posible consultar las categorías.'
  } finally {
    loading.value = false
  }
}

function openCreateForm() {
  editingId.value = null
  form.value = {
    name: '',
    description: '',
    active: true
  }
  showForm.value = true
}

function editCategory(category: Category) {
  editingId.value = category.id

  form.value = {
    name: category.name,
    description: category.description || '',
    active: category.active
  }

  showForm.value = true
}

async function saveCategory() {
  const name = form.value.name.trim()

  if (!name) {
    alert('Ingresa el nombre de la categoría.')
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    const data = {
      name,
      description: form.value.description.trim(),
      active: form.value.active
    }

    if (editingId.value !== null) {
      await api.put(`/categories/${editingId.value}`, data)
    } else {
      await api.post('/categories', data)
    }

    showForm.value = false

    await loadCategories()

    alert(
      editingId.value === null
        ? 'Categoría registrada correctamente.'
        : 'Categoría actualizada correctamente.'
    )
  } catch (error: any) {
    console.error('Error al guardar categoría:', error)
    errorMessage.value =
      error.response?.data?.mensaje || 'No fue posible guardar la categoría.'
  } finally {
    saving.value = false
  }
}

async function deleteCategory(id: number) {
  if (!confirm('¿Deseas desactivar esta categoría?')) {
    return
  }

  errorMessage.value = ''

  try {
    await api.delete(`/categories/${id}`)
    await loadCategories()
    alert('Categoría desactivada correctamente.')
  } catch (error: any) {
    console.error('Error al desactivar categoría:', error)
    errorMessage.value =
      error.response?.data?.mensaje || 'No fue posible desactivar la categoría.'
  }
}

onMounted(loadCategories)
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Categorías</h2>
        <p>Organiza los productos del restaurante por categorías.</p>
      </div>

      <button class="primary-button" @click="openCreateForm">
        + Nueva categoría
      </button>
    </div>

    <section class="panel">
      <div class="product-filters">
        <input
          v-model="search"
          class="search-input"
          placeholder="Buscar categoría..."
        >
      </div>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="loading">
              <td colspan="4" class="empty-state">
                Cargando categorías...
              </td>
            </tr>

            <tr
              v-for="category in filteredCategories"
              :key="category.id"
            >
              <td><strong>{{ category.name }}</strong></td>
              <td>{{ category.description || '—' }}</td>

              <td>
                <span
                  class="status-pill"
                  :class="category.active ? 'ready' : 'pending'"
                >
                  {{ category.active ? 'Activa' : 'Inactiva' }}
                </span>
              </td>

              <td>
                <div class="product-actions">
                  <button
                    class="table-action"
                    @click="editCategory(category)"
                  >
                    Editar
                  </button>

                  <button
                    v-if="category.active"
                    class="table-action delete-action"
                    @click="deleteCategory(category.id)"
                  >
                    Desactivar
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="!loading && filteredCategories.length === 0">
              <td colspan="4" class="empty-state">
                No hay categorías registradas.
              </td>
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
      <form class="product-form" @submit.prevent="saveCategory">
        <h3>
          {{ editingId === null ? 'Nueva categoría' : 'Editar categoría' }}
        </h3>

        <label>Nombre</label>

        <input
          v-model="form.name"
          class="search-input"
          required
          maxlength="100"
        >

        <label>Descripción</label>

        <textarea
          v-model="form.description"
          class="search-input"
          rows="3"
        ></textarea>

        <label class="availability-field">
          <input v-model="form.active" type="checkbox">
          Categoría activa
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
            :disabled="saving"
          >
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
