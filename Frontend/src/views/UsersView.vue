<script setup lang="ts">
// Pantalla "Usuarios" (solo administrador): crear cajeros y meseros,
// cambiar su rol o contraseña, y desactivarlos.
import { computed, onMounted, ref } from 'vue'
import { usersService, type ManagedUser, type UserChanges } from '../services/users.service'
import { errorMessage } from '../services/api'
import { useAuthStore } from '../stores/auth'
import { ROLE_LABELS } from '../types/models'
import { formatDate } from '../utils/format'
import UserFormModal, { type UserFormValue } from '../components/users/UserFormModal.vue'

const auth = useAuthStore()

const users = ref<ManagedUser[]>([])
const loading = ref(false)
const loadError = ref('')
const editing = ref<ManagedUser | null>(null)
const showForm = ref(false)
const saving = ref(false)

const activeCount = computed(() => users.value.filter((user) => user.active).length)

async function load() {
  if (!navigator.onLine) {
    loadError.value = 'Necesita conexión para administrar usuarios.'
    return
  }

  loading.value = true
  loadError.value = ''

  try {
    users.value = await usersService.getAll()
  } catch (error) {
    loadError.value = errorMessage(error, 'No se pudieron cargar los usuarios.')
  } finally {
    loading.value = false
  }
}

function openNew() {
  editing.value = null
  showForm.value = true
}

function openEdit(user: ManagedUser) {
  editing.value = user
  showForm.value = true
}

async function save(value: UserFormValue) {
  saving.value = true

  try {
    if (editing.value === null) {
      await usersService.create(value)
      alert(`Usuario "${value.username}" creado.`)
    } else {
      const changes: UserChanges = { fullName: value.fullName, role: value.role }
      if (value.password) changes.password = value.password
      await usersService.update(editing.value.id, changes)
      alert('Usuario actualizado.')
    }

    showForm.value = false
    await load()
  } catch (error) {
    alert(errorMessage(error, 'No se pudo guardar el usuario.'))
  } finally {
    saving.value = false
  }
}

async function toggleActive(user: ManagedUser) {
  const question = user.active
    ? `¿Desactivar a ${user.fullName}? No podrá iniciar sesión y se cerrarán sus sesiones abiertas.`
    : `¿Activar de nuevo a ${user.fullName}?`

  if (!window.confirm(question)) return

  try {
    await usersService.update(user.id, { active: !user.active })
    await load()
  } catch (error) {
    alert(errorMessage(error, 'No se pudo cambiar el estado del usuario.'))
  }
}

onMounted(load)
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Usuarios</h2>
        <p>Cree y administre las cuentas de cajeros, meseros y administradores.</p>
      </div>

      <button class="primary-button" :disabled="loading || !!loadError" @click="openNew">+ Nuevo usuario</button>
    </div>

    <div class="stats-grid products-summary">
      <article class="stat-card">
        <p class="stat-label">Usuarios</p>
        <h3>{{ users.length }}</h3>
      </article>
      <article class="stat-card">
        <p class="stat-label">Activos</p>
        <h3>{{ activeCount }}</h3>
      </article>
    </div>

    <section class="panel">
      <div v-if="loadError" class="error-message">{{ loadError }}</div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Creado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && !users.length">
              <td colspan="6">Cargando usuarios...</td>
            </tr>

            <tr v-for="user in users" :key="user.id" :class="{ inactive: !user.active }">
              <td>
                <strong>{{ user.username }}</strong>
                <small v-if="user.id === auth.user?.id" class="you">(usted)</small>
              </td>
              <td>{{ user.fullName }}</td>
              <td>{{ ROLE_LABELS[user.role] }}</td>
              <td>
                <span class="status-pill" :class="user.active ? 'ready' : 'pending'">
                  {{ user.active ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td>{{ formatDate(user.createdAt) }}</td>
              <td>
                <div class="product-actions">
                  <button class="table-action" @click="openEdit(user)">Editar</button>
                  <button
                    v-if="user.id !== auth.user?.id"
                    class="table-action"
                    :class="{ 'delete-action': user.active }"
                    @click="toggleActive(user)"
                  >
                    {{ user.active ? 'Desactivar' : 'Activar' }}
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="!loading && !users.length && !loadError">
              <td colspan="6" class="empty-state">No hay usuarios.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <UserFormModal v-if="showForm" :user="editing" :busy="saving" @close="showForm = false" @save="save" />
  </div>
</template>

<style scoped>
.you {
  margin-left: 6px;
  color: #718096;
}

tr.inactive td {
  opacity: 0.6;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
