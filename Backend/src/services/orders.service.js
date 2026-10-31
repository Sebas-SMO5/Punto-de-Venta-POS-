const ordersRepository = require('../repositories/orders.repository')

const validStatuses = [
  'pending',
  'preparing',
  'ready',
  'completed',
  'cancelled'
]

function validateOrder(data) {
  if (!Number.isInteger(Number(data.tableId)) || Number(data.tableId) <= 0) {
    const error = new Error('El identificador de la mesa no es válido')
    error.status = 400
    throw error
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    const error = new Error('El pedido debe incluir al menos un producto')
    error.status = 400
    throw error
  }

  for (const item of data.items) {
    if (
      !Number.isInteger(Number(item.productId)) ||
      Number(item.productId) <= 0 ||
      !Number.isInteger(Number(item.quantity)) ||
      Number(item.quantity) <= 0
    ) {
      const error = new Error('Los productos del pedido contienen datos inválidos')
      error.status = 400
      throw error
    }
  }
}

async function getAll() {
  return ordersRepository.getAll()
}

async function getById(id) {
  return ordersRepository.getById(id)
}

async function create(data) {
  validateOrder(data)

  return ordersRepository.create({
    ...data,
    tableId: Number(data.tableId),
    items: data.items.map(item => ({
      productId: Number(item.productId),
      quantity: Number(item.quantity)
    }))
  })
}

async function updateStatus(id, status) {
  if (!validStatuses.includes(status)) {
    const error = new Error('El estado del pedido no es válido')
    error.status = 400
    throw error
  }

  return ordersRepository.updateStatus(id, status)
}

async function cancel(id) {
  return ordersRepository.updateStatus(id, 'cancelled')
}

module.exports = {
  getAll,
  getById,
  create,
  updateStatus,
  cancel
}