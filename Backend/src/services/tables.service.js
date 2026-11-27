// Lógica de negocio de mesas.
const tablesRepository = require('../repositories/tables.repository')
const AppError = require('../utils/AppError')

async function getAll() {
  return tablesRepository.getAll()
}

async function getById(id) {
  const table = await tablesRepository.getById(id)

  if (!table) throw AppError.notFound('Mesa no encontrada')

  return table
}

module.exports = {
  getAll,
  getById
}
