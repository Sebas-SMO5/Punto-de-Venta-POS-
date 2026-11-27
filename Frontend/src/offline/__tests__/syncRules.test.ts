// Pruebas unitarias de las reglas determinísticas de sincronización.
import { describe, expect, it } from 'vitest'
import { backoffDelay, decide, waitingForDependency } from '../syncRules'
import type { PendingOperation } from '../db'

function op(partial: Partial<PendingOperation>): PendingOperation {
  return {
    operationId: 'x',
    type: 'CREATE',
    entity: 'orders',
    data: {},
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
    ...partial,
  }
}

describe('decide (qué hacer cuando el servidor responde con error)', () => {
  it('sin red: se reintenta más tarde', () => {
    expect(decide({ status: undefined }, 'CREATE')).toEqual({ action: 'retry_later' })
  })

  it('servidor caído (5xx): se reintenta más tarde', () => {
    expect(decide({ status: 503 }, 'UPDATE').action).toBe('retry_later')
  })

  it('sesión vencida (401): se detiene la sincronización', () => {
    expect(decide({ status: 401 }, 'UPDATE').action).toBe('stop')
  })

  it('pedido que ya avanzó (409 INVALID_TRANSITION): gana el servidor automáticamente', () => {
    const decision = decide({ status: 409, reason: 'INVALID_TRANSITION', server: { status: 'completed' } }, 'UPDATE')
    expect(decision.action).toBe('server_wins')
  })

  it('producto editado por otro (409 VERSION_MISMATCH): conflicto manual', () => {
    const decision = decide({ status: 409, reason: 'VERSION_MISMATCH', message: 'Cambiado' }, 'UPDATE')
    expect(decision).toMatchObject({ action: 'conflict', reason: 'VERSION_MISMATCH' })
  })

  it('venta sin stock (409 INSUFFICIENT_STOCK): conflicto manual', () => {
    expect(decide({ status: 409, reason: 'INSUFFICIENT_STOCK' }, 'CREATE').action).toBe('conflict')
  })

  it('editar algo que ya no existe (404): gana el servidor y se descarta', () => {
    expect(decide({ status: 404 }, 'UPDATE').action).toBe('server_wins')
    expect(decide({ status: 404 }, 'DELETE').action).toBe('server_wins')
  })

  it('datos inválidos o sin permiso: error para revisión', () => {
    expect(decide({ status: 400, message: 'Precio inválido' }, 'CREATE')).toEqual({
      action: 'error',
      message: 'Precio inválido',
    })
    expect(decide({ status: 403 }, 'CREATE').action).toBe('error')
  })

  it('es determinística: la misma entrada da siempre la misma salida', () => {
    const input = { status: 409, reason: 'VERSION_MISMATCH', message: 'm' }
    expect(decide(input, 'UPDATE')).toEqual(decide(input, 'UPDATE'))
  })
})

describe('backoffDelay (espera creciente entre intentos)', () => {
  it('duplica la espera en cada intento', () => {
    expect(backoffDelay(1)).toBe(2000)
    expect(backoffDelay(2)).toBe(4000)
    expect(backoffDelay(3)).toBe(8000)
  })

  it('no espera más de 5 minutos', () => {
    expect(backoffDelay(50)).toBe(5 * 60 * 1000)
  })
})

describe('waitingForDependency (esperar a que se cree primero lo que se usa)', () => {
  it('una venta de un pedido que aún no se sincroniza debe esperar', () => {
    expect(waitingForDependency(op({ entity: 'sales', data: { orderId: -123 } }))).toBe(true)
    expect(waitingForDependency(op({ entity: 'sales', data: { orderId: 5 } }))).toBe(false)
  })

  it('cambiar el estado de un pedido con id temporal debe esperar', () => {
    expect(waitingForDependency(op({ type: 'UPDATE', data: { id: -9 } }))).toBe(true)
  })

  it('un pedido con un producto creado sin conexión debe esperar', () => {
    const order = op({ data: { items: [{ productId: -1, quantity: 1 }] } })
    expect(waitingForDependency(order)).toBe(true)
  })

  it('crear un registro nuevo no espera por su propio id temporal', () => {
    expect(waitingForDependency(op({ entity: 'products', data: { id: -5 } }))).toBe(false)
  })
})
