const inventoryService = require('../services/inventory.service')

async function getInventory(req, res, next) {
  try {
    const inventory = await inventoryService.getAll()
    res.json(inventory)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getInventory
}