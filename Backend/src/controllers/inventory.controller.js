// Controlador de inventario: recibe la petición, llama al servicio y responde.
const inventoryService = require('../services/inventory.service')

async function getInventory(req, res, next) {
  try {
    res.json(await inventoryService.getAll())
  } catch (error) {
    next(error)
  }
}

async function createMovement(req, res, next) {
  try {
    const { item, duplicate } = await inventoryService.registerMovement(req.body, req.user)
    // 200 si ya existía (reenvío desde la cola offline), 201 si es nuevo
    res.status(duplicate ? 200 : 201).json(item)
  } catch (error) {
    next(error)
  }
}

async function getMovements(req, res, next) {
  try {
    res.json(await inventoryService.listMovements(req.validatedQuery))
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getInventory,
  createMovement,
  getMovements
}
