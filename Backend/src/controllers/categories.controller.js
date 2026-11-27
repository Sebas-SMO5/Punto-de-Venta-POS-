// Controlador de categorías: recibe la petición, llama al servicio y responde.
const service = require('../services/categories.service')

async function getCategories(req, res, next) {
  try {
    res.json(await service.getAll())
  } catch (error) {
    next(error)
  }
}

async function getCategory(req, res, next) {
  try {
    res.json(await service.getById(req.params.id))
  } catch (error) {
    next(error)
  }
}

async function createCategory(req, res, next) {
  try {
    res.status(201).json(await service.create(req.body))
  } catch (error) {
    next(error)
  }
}

async function updateCategory(req, res, next) {
  try {
    res.json(await service.update(req.params.id, req.body))
  } catch (error) {
    next(error)
  }
}

async function deactivateCategory(req, res, next) {
  try {
    await service.deactivate(req.params.id)
    res.json({ mensaje: 'Categoría desactivada correctamente' })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deactivateCategory
}
