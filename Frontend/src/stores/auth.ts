// Tienda (Pinia) de la sesión del usuario.
//
// - El Access Token vive solo en memoria (services/session.ts).
// - Del usuario solo se guarda su perfil (id, nombre, rol) en el navegador,
//   para poder seguir trabajando SIN CONEXIÓN después de recargar la página.
//   Nunca se guardan tokens ni contraseñas en localStorage.
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import axios from 'axios'
import {
  authClient,
  getAccessToken,
  onSessionChange,
  refreshSession,
  setSession,
} from '../services/session'
import { api } from '../services/api'
import type { ActiveSession, AuthUser, Role, SessionResponse } from '../types/models'

const PROFILE_KEY = 'pos_profile'

function readCachedProfile(): AuthUser | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function cacheProfile(user: AuthUser | null): void {
  try {
    if (user) localStorage.setItem(PROFILE_KEY, JSON.stringify(user))
    else localStorage.removeItem(PROFILE_KEY)
  } catch {
    // Navegador sin almacenamiento disponible: se ignora
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(readCachedProfile())
  const hasToken = ref(getAccessToken() !== null)
  const sessionChecked = ref(false)
  const loading = ref(false)
  const error = ref('')

  // Cuando la sesión cambia (login, renovación, expiración) se actualiza
  onSessionChange((sessionUser, token) => {
    hasToken.value = token !== null

    if (sessionUser) {
      user.value = sessionUser
      cacheProfile(sessionUser)
    } else if (token === null && navigator.onLine) {
      // La sesión terminó en el servidor: se borra el perfil local
      user.value = null
      cacheProfile(null)
    }
  })

  // Hay sesión si existe token, o si no hay internet y hay un perfil guardado
  const isAuthenticated = computed(() => user.value !== null && (hasToken.value || !navigator.onLine))
  const offlineMode = computed(() => user.value !== null && !hasToken.value)
  const role = computed<Role | null>(() => user.value?.role ?? null)
  const isAdmin = computed(() => role.value === 'admin')

  function hasRole(...roles: Role[]): boolean {
    return role.value !== null && roles.includes(role.value)
  }

  // La usan las protecciones de rutas (Navigation Guards) al abrir la app:
  // si no hay token en memoria, intenta recuperarlo con la cookie.
  async function ensureSession(): Promise<boolean> {
    if (hasToken.value) return true

    if (navigator.onLine) {
      try {
        await refreshSession()
      } catch {
        // El servidor no respondió: se trabaja con el perfil guardado
      }
    }

    sessionChecked.value = true
    return isAuthenticated.value
  }

  async function login(username: string, password: string): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      const { data } = await authClient.post<SessionResponse>('/auth/login', {
        username,
        password,
      })
      setSession(data.accessToken, data.user)
    } catch (err) {
      error.value = axios.isAxiosError(err)
        ? ((err.response?.data as { mensaje?: string } | undefined)?.mensaje ??
          'No se pudo conectar con el servidor')
        : 'Error inesperado al iniciar sesión'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    try {
      await authClient.post('/auth/logout')
    } catch {
      // Aunque falle la red, la sesión local se cierra igual
    }

    setSession(null, null)
    user.value = null
    cacheProfile(null)
  }

  async function logoutAll(): Promise<void> {
    await api.post('/auth/logout-all')
    setSession(null, null)
    user.value = null
    cacheProfile(null)
  }

  async function listSessions(): Promise<ActiveSession[]> {
    const { data } = await api.get<ActiveSession[]>('/auth/sessions')
    return data
  }

  async function revokeSession(id: string): Promise<void> {
    await api.delete(`/auth/sessions/${id}`)
  }

  return {
    user,
    loading,
    error,
    sessionChecked,
    isAuthenticated,
    offlineMode,
    role,
    isAdmin,
    hasRole,
    ensureSession,
    login,
    logout,
    logoutAll,
    listSessions,
    revokeSession,
  }
})
