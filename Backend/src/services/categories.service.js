// Lógica de negocio de categorías (los datos ya llegan validados por Zod).
const repository = require('../repositories/categories.repository')
const AppError = require('../utils/AppError')

async function getAll() {
  return repository.getAll()
}

async function getById(id) {
  const category = await repository.getById(id)

  if (!category) throw AppError.notFound('Categoría no encontrada')

  return category
}

async function create(data) {
  return repository.create(data)
}

async function update(id, data) {
  const category = await repository.update(id, data)

  if (!category) throw AppError.notFound('Categoría no encontrada')

  return category
}

async function deactivate(id) {
  const done = await repository.deactivate(id)

  if (!done) throw AppError.notFound('Categoría no encontrada')
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  deactivate
}
