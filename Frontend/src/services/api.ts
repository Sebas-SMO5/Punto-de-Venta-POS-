// Cliente HTTP (axios) que usan todas las pantallas para hablar con la API.
// Hace tres cosas automáticamente con "interceptores":
//   1. Agrega el Access Token a cada petición.
//   2. Si la API responde 401 (token vencido), renueva la sesión con la
//      cookie y repite la petición una vez.
//   3. Si falla la red o el servidor está caído (502/503/504), reintenta
//      las consultas hasta 3 veces esperando cada vez más (0.5s, 1s, 2s).
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { API_URL, getAccessToken, refreshSession, setSession } from './session'

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _authRetried?: boolean
    _retryCount?: number
  }
}

const MAX_RETRIES = 3
const RETRY_STATUSES = [502, 503, 504]
const IDEMPOTENT_METHODS = ['get', 'head', 'options', 'put', 'delete']

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

function shouldRetry(error: AxiosError, config: InternalAxiosRequestConfig): boolean {
  const method = (config.method || 'get').toLowerCase()
  const status = error.response?.status
  const networkError = !error.response

  return (
    navigator.onLine &&
    IDEMPOTENT_METHODS.includes(method) &&
    (config._retryCount ?? 0) < MAX_RETRIES &&
    (networkError || (status !== undefined && RETRY_STATUSES.includes(status)))
  )
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config

    if (!config) return Promise.reject(error)

    const isAuthRoute = config.url?.includes('/auth/')

    if (error.response?.status === 401 && !config._authRetried && !isAuthRoute) {
      config._authRetried = true

      try {
        const session = await refreshSession()

        if (session) {
          return api(config)
        }
      } catch {
        // Sin conexión: se devuelve el error original
      }

      setSession(null, null)
      return Promise.reject(error)
    }

    if (shouldRetry(error, config)) {
      config._retryCount = (config._retryCount ?? 0) + 1
      const delay = 500 * 2 ** (config._retryCount - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return api(config)
    }

    return Promise.reject(error)
  },
)

// Saca un mensaje entendible de cualquier error (para mostrar al usuario)
export function errorMessage(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { mensaje?: string } | undefined

    if (data?.mensaje) return data.mensaje
    if (!error.response) return 'No se pudo conectar con el servidor'
  }

  if (error instanceof Error && error.message) return error.message

  return fallback
}

// true si el error es por falta de conexión (no por un rechazo del servidor)
export function isConnectionError(error: unknown): boolean {
  if (!navigator.onLine) return true

  return axios.isAxiosError(error) && !error.response
}
