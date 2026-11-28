// Lógica de negocio del inventario.
// - Entradas de mercancía: administrador y cajero.
// - Ajustes por conteo físico: solo el administrador (cambian el stock a un
//   valor exacto, así que pueden "borrar" ventas si se usan mal).
const inventoryRepository = require('../repositories/inventory.repository')
const AppError = require('../utils/AppError')
const logger = require('../utils/logger')

async function getAll() {
  return inventoryRepository.getAll()
}

async function registerMovement(data, user) {
  if (data.type === 'adjustment' && user.role !== 'admin') {
    throw AppError.forbidden('Solo el administrador puede hacer ajustes de inventario')
  }

  const result = await inventoryRepository.registerMovement({ ...data, userId: user.id })

  if (!result.duplicate) {
    logger.info('Movimiento de inventario', {
      productId: data.productId,
      type: data.type,
      quantity: data.quantity,
      userId: user.id
    })
  }

  return result
}

async function listMovements(filters) {
  return inventoryRepository.listMovements(filters)
}

module.exports = {
  getAll,
  registerMovement,
  listMovements
}
