<script setup lang="ts">
// Pantalla "Mis sesiones": muestra en qué dispositivos está abierta la
// cuenta y permite cerrar uno o todos (revocación de sesiones).
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { errorMessage } from '../services/api'
import type { ActiveSession } from '../types/models'

const auth = useAuthStore()
const router = useRouter()

const sessions = ref<ActiveSession[]>([])
const loading = ref(false)
const error = ref('')

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Dispositivo desconocido'
  if (/Android/i.test(userAgent)) return 'Android'
  if (/iPhone|iPad/i.test(userAgent)) return 'iPhone / iPad'
  if (/Windows/i.test(userAgent)) return 'Windows'
  if (/Mac OS/i.test(userAgent)) return 'Mac'
  if (/Linux/i.test(userAgent)) return 'Linux'
  return 'Navegador'
}

async function load() {
  if (!navigator.onLine) {
    error.value = 'Necesita conexión para ver las sesiones abiertas.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    sessions.value = await auth.listSessions()
  } catch (err) {
    error.value = errorMessage(err, 'No se pudieron cargar las sesiones')
  } finally {
    loading.value = false
  }
}

async function revoke(session: ActiveSession) {
  if (session.current) {
    await auth.logout()
    await router.replace('/login')
    return
  }

  try {
    await auth.revokeSession(session.id)
    await load()
  } catch (err) {
    error.value = errorMessage(err, 'No se pudo cerrar la sesión')
  }
}

async function revokeAll() {
  if (!window.confirm('¿Cerrar la sesión en TODOS los dispositivos, incluido este?')) return

  try {
    await auth.logoutAll()
    await router.replace('/login')
  } catch (err) {
    error.value = errorMessage(err, 'No se pudieron cerrar las sesiones')
  }
}

onMounted(load)
</script>

<template>
  <div class="products-page">
    <div class="page-title-row">
      <div>
        <h2>Mis sesiones</h2>
        <p>Dispositivos donde su cuenta está abierta en este momento.</p>
      </div>

      <button class="primary-button" :disabled="loading || !sessions.length" @click="revokeAll">
        Cerrar todas las sesiones
      </button>
    </div>

    <p v-if="error" class="sessions-error" role="alert">{{ error }}</p>

    <section class="panel">
      <p v-if="loading" class="empty-state">Cargando sesiones…</p>

      <table v-else-if="sessions.length" class="data-table">
        <thead>
          <tr>
            <th>Dispositivo</th>
            <th>Inicio</th>
            <th>Última actividad</th>
            <th>IP</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="session in sessions" :key="session.id">
            <td>
              {{ describeDevice(session.userAgent) }}
              <span v-if="session.current" class="status-pill ready">Este dispositivo</span>
            </td>
            <td>{{ new Date(session.startedAt).toLocaleString('es-CO') }}</td>
            <td>{{ new Date(session.lastActivityAt).toLocaleString('es-CO') }}</td>
            <td>{{ session.ipAddress || '—' }}</td>
            <td>
              <button class="table-action delete-action" @click="revoke(session)">
                {{ session.current ? 'Salir' : 'Cerrar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else class="empty-state">No hay sesiones activas.</p>
    </section>
  </div>
</template>

<style scoped>
.sessions-error {
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #fdecec;
  color: #b42318;
}

.status-pill {
  margin-left: 8px;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
