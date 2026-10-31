const repository = require('../repositories/categories.repository')

function validateId(id) {
  const parsedId = Number(id)

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    const error = new Error('Identificador de categoría inválido')
    error.status = 400
    throw error
  }

  return parsedId
}

function validateData(data) {
  if (
    !data ||
    typeof data.name !== 'string' ||
    !data.name.trim()
  ) {
    const error = new Error('El nombre de la categoría es obligatorio')
    error.status = 400
    throw error
  }

  if (
    data.description !== undefined &&
    data.description !== null &&
    typeof data.description !== 'string'
  ) {
    const error = new Error('La descripción no es válida')
    error.status = 400
    throw error
  }

  if (data.active !== undefined && typeof data.active !== 'boolean') {
    const error = new Error('El estado de la categoría no es válido')
    error.status = 400
    throw error
  }

  return {
    name: data.name.trim(),
    description: data.description || '',
    active: data.active ?? true
  }
}

async function getAll() {
  return repository.getAll()
}

async function getById(id) {
  return repository.getById(validateId(id))
}

async function create(data) {
  return repository.create(validateData(data))
}

async function update(id, data) {
  return repository.update(validateId(id), validateData(data))
}

async function deactivate(id) {
  return repository.deactivate(validateId(id))
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  deactivate
}