// Lógica de ventas. Después de cobrar, encola una tarea en segundo plano
// que revisa si algún producto vendido quedó por debajo del stock mínimo.
const salesRepository = require('../repositories/sales.repository')
const inventoryRepository = require('../repositories/inventory.repository')
const AppError = require('../utils/AppError')
const logger = require('../utils/logger')
const { queue } = require('../utils/jobQueue')

queue.register('check-low-stock', async ({ productIds }) => {
  const lowStock = await inventoryRepository.findLowStock(productIds)

  for (const item of lowStock) {
    logger.warn('Producto con stock bajo', {
      productId: item.product_id,
      product: item.name,
      stock: Number(item.current_stock),
      minimum: Number(item.minimum_stock)
    })
  }
})

async function getAll() {
  return salesRepository.getAll()
}

async function getById(id) {
  const sale = await salesRepository.getById(id)

  if (!sale) throw AppError.notFound('Venta no encontrada')

  return sale
}

async function createFromOrder({ orderId, paymentMethodId, reference }, user) {
  const sale = await salesRepository.createFromOrder(
    orderId,
    paymentMethodId,
    reference ?? null,
    user.id
  )

  const productIds = (sale?.items || [])
    .map(item => Number(item.productId))
    .filter(Number.isInteger)

  if (productIds.length) {
    queue.add('check-low-stock', { productIds })
  }

  return sale
}

async function getPaymentMethods() {
  return salesRepository.getPaymentMethods()
}

module.exports = {
  getAll,
  getById,
  createFromOrder,
  getPaymentMethods
}
