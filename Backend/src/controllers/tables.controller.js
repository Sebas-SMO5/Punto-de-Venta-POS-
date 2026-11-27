// Controlador de mesas: recibe la petición, llama al servicio y responde.
const tablesService = require('../services/tables.service')

async function getTables(req, res, next) {
  try {
    res.json(await tablesService.getAll())
  } catch (error) {
    next(error)
  }
}

async function getTableById(req, res, next) {
  try {
    res.json(await tablesService.getById(req.params.id))
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getTables,
  getTableById
}
