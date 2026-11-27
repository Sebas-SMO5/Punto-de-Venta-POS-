// Lógica de negocio de productos. Los datos ya llegan validados por Zod;
// aquí van las reglas del negocio y los errores "no encontrado".
const productsRepository = require('../repositories/products.repository')
const AppError = require('../utils/AppError')

async function getAll() {
  return productsRepository.getAll()
}

async function getById(id) {
  const product = await productsRepository.getById(id)

  if (!product) throw AppError.notFound('Producto no encontrado')

  return product
}

async function create(data) {
  return productsRepository.create(data)
}

async function update(id, data) {
  const product = await productsRepository.update(id, data)

  if (!product) throw AppError.notFound('Producto no encontrado')

  return product
}

async function remove(id) {
  const deleted = await productsRepository.delete(id)

  if (!deleted) throw AppError.notFound('Producto no encontrado')
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: remove
}
