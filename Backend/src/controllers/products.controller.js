// Controlador de productos: recibe la petición, llama al servicio y responde.
const productsService = require('../services/products.service')

async function getProducts(req, res, next) {
  try {
    res.json(await productsService.getAll())
  } catch (error) {
    next(error)
  }
}

async function getProductById(req, res, next) {
  try {
    res.json(await productsService.getById(req.params.id))
  } catch (error) {
    next(error)
  }
}

async function createProduct(req, res, next) {
  try {
    res.status(201).json(await productsService.create(req.body))
  } catch (error) {
    next(error)
  }
}

async function updateProduct(req, res, next) {
  try {
    res.json(await productsService.update(req.params.id, req.body))
  } catch (error) {
    next(error)
  }
}

async function deleteProduct(req, res, next) {
  try {
    await productsService.delete(req.params.id)
    res.json({ mensaje: 'Producto desactivado correctamente' })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
}
