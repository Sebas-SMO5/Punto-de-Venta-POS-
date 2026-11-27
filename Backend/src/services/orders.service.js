// Lógica de negocio de pedidos. Los datos ya llegan validados por Zod.
// El usuario que crea el pedido es SIEMPRE el que inició sesión (req.user),
// nunca un dato que mande el navegador.
const ordersRepository = require('../repositories/orders.repository')
const AppError = require('../utils/AppError')

async function getAll() {
  return ordersRepository.getAll()
}

async function getById(id) {
  const order = await ordersRepository.getById(id)

  if (!order) throw AppError.notFound('Pedido no encontrado')

  return order
}

// Si el pedido trae localId (se creó sin conexión) y ya existe, el
// repositorio devuelve el mismo pedido en vez de duplicarlo (idempotencia).
async function create(data, user) {
  return ordersRepository.create({ ...data, userId: user.id })
}

async function updateStatus(id, status, user) {
  return ordersRepository.updateStatus(id, status, user)
}

async function cancel(id, user) {
  return ordersRepository.updateStatus(id, 'cancelled', user)
}

module.exports = {
  getAll,
  getById,
  create,
  updateStatus,
  cancel
}
