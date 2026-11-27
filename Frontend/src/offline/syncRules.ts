// REGLAS DETERMINÍSTICAS de sincronización.
// "Determinístico" quiere decir que, ante la misma situación, el sistema
// SIEMPRE toma la misma decisión. Estas funciones no tocan la red ni la
// base local, así se pueden probar fácilmente (ver tests/syncRules.test.ts).
//
// Tabla de decisiones cuando el servidor responde con error:
//
// | Respuesta del servidor             | Decisión                                   |
// |------------------------------------|--------------------------------------------|
// | Sin respuesta (sin red)            | retry_later: se queda pendiente            |
// | 502 / 503 / 504 / 500              | retry_later con espera creciente           |
// | 401 (sesión vencida)               | stop: se detiene hasta iniciar sesión      |
// | 409 INVALID_TRANSITION (pedido)    | server_wins: el pedido ya avanzó; se acepta|
// |                                    |   lo que dice el servidor automáticamente  |
// | 409 VERSION_MISMATCH (producto...) | conflict: el usuario elige qué versión     |
// | 409 INSUFFICIENT_STOCK (venta)     | conflict: el usuario reintenta o descarta  |
// | 404 al editar o borrar             | server_wins: ya no existe; se descarta     |
// | Otro 4xx (400, 403...)             | error: datos inválidos o sin permiso       |
import type { OperationType, PendingOperation } from './db'

export type SyncDecision =
  | { action: 'retry_later' }
  | { action: 'stop' }
  | { action: 'conflict'; reason: string; message: string; server?: unknown }
  | { action: 'server_wins'; message: string; server?: unknown }
  | { action: 'error'; message: string }

export interface ServerFailure {
  status?: number
  reason?: string
  message?: string
  server?: unknown
}

const MANUAL_CONFLICTS = ['VERSION_MISMATCH', 'INSUFFICIENT_STOCK']

export function decide(failure: ServerFailure, type: OperationType): SyncDecision {
  const { status, reason, server } = failure
  const message = failure.message || 'Error desconocido'

  if (status === undefined) return { action: 'retry_later' }
  if (status >= 500) return { action: 'retry_later' }
  if (status === 401) return { action: 'stop' }

  if (status === 409) {
    if (reason && MANUAL_CONFLICTS.includes(reason)) {
      return { action: 'conflict', reason, message, server }
    }

    return { action: 'server_wins', message, server }
  }

  if (status === 404 && type !== 'CREATE') {
    return { action: 'server_wins', message: 'El registro ya no existe en el servidor', server }
  }

  return { action: 'error', message }
}

// Espera antes del siguiente intento: 2s, 4s, 8s... hasta 5 minutos
export function backoffDelay(attempts: number): number {
  return Math.min(1000 * 2 ** Math.max(1, attempts), 5 * 60 * 1000)
}

// Un id negativo significa "creado sin conexión y todavía sin id del
// servidor". Una operación que depende de él debe esperar a que el
// registro original se sincronice primero.
export function waitingForDependency(operation: PendingOperation): boolean {
  const { data, type, entity } = operation
  const isNegative = (value: unknown) => typeof value === 'number' && value < 0

  if (type !== 'CREATE' && isNegative(data.id)) return true
  if (entity === 'sales' && isNegative(data.orderId)) return true

  if (entity === 'orders' && Array.isArray(data.items)) {
    return data.items.some(
      (item) => typeof item === 'object' && item !== null && isNegative((item as { productId?: unknown }).productId),
    )
  }

  return false
}
