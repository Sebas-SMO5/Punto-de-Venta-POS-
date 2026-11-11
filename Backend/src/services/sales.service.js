const salesRepository = require('../repositories/sales.repository')

async function getAll() {
  return salesRepository.getAll()
}

async function getById(id) {
  return salesRepository.getById(id)
}

async function createFromOrder(orderId, paymentMethodId, reference) {
  return salesRepository.createFromOrder(
    orderId,
    paymentMethodId,
    reference
  )
}

module.exports = {
  getAll,
  getById,
  createFromOrder
}