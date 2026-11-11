const productsRepository = require('../repositories/products.repository')

function validateStock(value, fieldName) {
  const number = Number(value)

  if (!Number.isFinite(number) || number < 0) {
    const error = new Error(`${fieldName} debe ser un número mayor o igual a cero`)
    error.status = 400
    throw error
  }

  return number
}

function validateProduct(data) {
  if (
    typeof data.name !== 'string' ||
    !data.name.trim() ||
    typeof data.category !== 'string' ||
    !data.category.trim() ||
    !Number.isFinite(Number(data.price)) ||
    Number(data.price) <= 0 ||
    (data.available !== undefined && typeof data.available !== 'boolean')
  ) {
    const error = new Error('Los datos del producto no son válidos')
    error.status = 400
    throw error
  }

  data.price = Number(data.price)

  if (data.current_stock !== undefined) {
    data.current_stock = validateStock(
      data.current_stock,
      'El stock inicial'
    )
  }

  if (data.minimum_stock !== undefined) {
    data.minimum_stock = validateStock(
      data.minimum_stock,
      'El stock mínimo'
    )
  }
}

async function getAll() {
  return productsRepository.getAll()
}

async function getById(id) {
  return productsRepository.getById(id)
}

async function create(data) {
  validateProduct(data)

  data.current_stock = data.current_stock ?? 0
  data.minimum_stock = data.minimum_stock ?? 0

  return productsRepository.create(data)
}

async function update(id, data) {
  const current = await productsRepository.getById(id)

  if (!current) {
    return null
  }

  validateProduct({
    name: data.name ?? current.name,
    category: data.category ?? current.category,
    price: Number(data.price ?? current.price),
    available: data.available ?? current.available
  })

  if (data.minimum_stock !== undefined) {
    data.minimum_stock = validateStock(
      data.minimum_stock,
      'El stock mínimo'
    )
  }

  if (data.current_stock !== undefined) {
    data.current_stock = validateStock(
      data.current_stock,
      'El stock actual'
    )

    const error = new Error(
      'El stock actual no se puede modificar desde la edición del producto'
    )
    error.status = 400
    throw error
  }

  if (data.price !== undefined) {
    data.price = Number(data.price)
  }

  return productsRepository.update(id, data)
}

async function remove(id) {
  return productsRepository.delete(id)
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: remove
}