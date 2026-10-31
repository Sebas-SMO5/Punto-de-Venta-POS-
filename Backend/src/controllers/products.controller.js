const productsService = require('../services/products.service')

async function getProducts(req, res, next) {
  try {
    const products = await productsService.getAll()
    res.json(products)
  } catch (error) {
    next(error)
  }
}

async function getProductById(req, res, next) {
  try {
    const product = await productsService.getById(Number(req.params.id))

    if (!product) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' })
    }

    res.json(product)
  } catch (error) {
    next(error)
  }
}

async function createProduct(req, res, next) {
  try {
    const product = await productsService.create(req.body)
    res.status(201).json(product)
  } catch (error) {
    next(error)
  }
}

async function updateProduct(req, res, next) {
  try {
    const product = await productsService.update(
      Number(req.params.id),
      req.body
    )

    if (!product) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' })
    }

    res.json(product)
  } catch (error) {
    next(error)
  }
}

async function deleteProduct(req, res, next) {
  try {
    const deleted = await productsService.delete(Number(req.params.id))

    if (!deleted) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' })
    }

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