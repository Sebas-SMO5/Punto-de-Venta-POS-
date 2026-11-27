// Reglas de negocio de los pedidos, escritas como funciones "puras"
// (no tocan la base de datos), para poder probarlas fácilmente.
//
// MÁQUINA DE ESTADOS: un pedido solo avanza, nunca retrocede.
//   pending -> preparing -> ready -> completed
//   y desde cualquier estado no final se puede pasar a cancelled.
//
// Esto hace que la resolución de conflictos sea DETERMINÍSTICA: si dos
// dispositivos cambian el mismo pedido sin conexión, al sincronizar
// siempre gana el estado más avanzado, sin importar quién llegó primero.

const STATUS_ORDER = ['pending', 'preparing', 'ready', 'completed']
const FINAL_STATUSES = ['completed', 'cancelled']

// Devuelve:
//   'apply'    -> el cambio es válido, se aplica
//   'noop'     -> el pedido ya está en ese estado (reintento repetido): no
//                 se hace nada y se responde OK (idempotencia)
//   'conflict' -> el cambio llega tarde (el pedido ya avanzó o terminó)
function evaluateTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return 'noop'

  if (FINAL_STATUSES.includes(currentStatus)) return 'conflict'

  if (nextStatus === 'cancelled') return 'apply'

  const currentRank = STATUS_ORDER.indexOf(currentStatus)
  const nextRank = STATUS_ORDER.indexOf(nextStatus)

  return nextRank > currentRank ? 'apply' : 'conflict'
}

// Propiedad del recurso: administrador y cajero pueden cambiar cualquier
// pedido; un mesero solo los pedidos que él mismo creó.
function canModifyOrder(user, order) {
  if (user.role === 'admin' || user.role === 'cashier') return true

  return Number(order.user_id) === Number(user.id)
}

module.exports = {
  STATUS_ORDER,
  FINAL_STATUSES,
  evaluateTransition,
  canModifyOrder
}
