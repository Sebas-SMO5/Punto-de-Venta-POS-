const inventoryRepository = require('../repositories/inventory.repository')

async function getAll() {
  return await inventoryRepository.getAll()
}

module.exports = {
  getAll
}