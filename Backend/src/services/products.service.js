const productsRepository = require('../repositories/products.repository')

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
}

async function getAll() {
  return productsRepository.getAll()
}

async function getById(id) {
  return productsRepository.getById(id)
}

async function create(data) {
  validateProduct(data)
  return productsRepository.create(data)
}

async function update(id, data) {
  if (data.name !== undefined || data.category !== undefined ||
      data.price !== undefined || data.available !== undefined) {
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

    data.price = Number(data.price ?? current.price)
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