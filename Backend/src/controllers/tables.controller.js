const tablesService = require('../services/tables.service')

async function getTables(req, res, next) {
  try {
    const tables = await tablesService.getAll()
    res.json(tables)
  } catch (error) {
    next(error)
  }
}

async function getTableById(req, res, next) {
  try {
    const id = Number(req.params.id)

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensaje: 'El identificador de la mesa no es válido'
      })
    }

    const table = await tablesService.getById(id)

    if (!table) {
      return res.status(404).json({
        mensaje: 'Mesa no encontrada'
      })
    }

    res.json(table)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getTables,
  getTableById
}