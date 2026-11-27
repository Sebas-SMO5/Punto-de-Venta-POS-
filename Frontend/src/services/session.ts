// Guarda el Access Token SOLO EN MEMORIA (una variable de JavaScript).
// Si se recarga la página, el token se pierde a propósito; se recupera
// pidiendo uno nuevo con la cookie HttpOnly del Refresh Token (que el
// JavaScript no puede leer, así que un ataque XSS no la puede robar).
import axios from 'axios'
import type { AuthUser, SessionResponse } from '../types/models'

export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

let accessToken: string | null = null

type SessionListener = (user: AuthUser | null, token: string | null) => void
const listeners = new Set<SessionListener>()

export function getAccessToken(): string | null {
  return accessToken
}

export function setSession(token: string | null, user: AuthUser | null): void {
  accessToken = token
  listeners.forEach((listener) => listener(user, token))
}

// La tienda de autenticación (Pinia) se suscribe para enterarse de cambios
export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Cliente sin interceptores, solo para hablar con /auth
export const authClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000,
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function doRefresh(attempt = 0): Promise<SessionResponse | null> {
  try {
    const { data } = await authClient.post<SessionResponse>('/auth/refresh')
    setSession(data.accessToken, data.user)
    return data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const code = (error.response.data as { detalles?: { code?: string } } | undefined)?.detalles
        ?.code

      // Otra pestaña está renovando al mismo tiempo: se espera y se reintenta
      if (code === 'REFRESH_RACE' && attempt < 3) {
        await wait(400 * (attempt + 1))
        return doRefresh(attempt + 1)
      }

      setSession(null, null)
      return null
    }

    // Sin conexión o servidor caído: no se cierra la sesión local
    throw error
  }
}

let refreshing: Promise<SessionResponse | null> | null = null

// Si varias peticiones necesitan renovar el token a la vez, todas esperan
// la MISMA renovación (así no se gastan varios refresh tokens).
export function refreshSession(): Promise<SessionResponse | null> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null
    })
  }

  return refreshing
}
