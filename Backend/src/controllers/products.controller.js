
const productsService = require('../services/products.service');

function getProducts(req, res, next) {
  try {
    res.json(productsService.getAll());
  } catch (error) {
    next(error);
  }
}

function getProductById(req, res, next) {
  try {
    const product = productsService.getById(Number(req.params.id));

    if (!product) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
}

function createProduct(req, res, next) {
  try {
    const product = productsService.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
}

function updateProduct(req, res, next) {
  try {
    const product = productsService.update(Number(req.params.id), req.body);

    if (!product) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
}

function deleteProduct(req, res, next) {
  try {
    const deleted = productsService.delete(Number(req.params.id));

    if (!deleted) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    res.status(200).json({ mensaje: 'Producto eliminado correctamente' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
