const service = require('../services/categories.service')

async function getCategories(req, res, next) {
  try {
    const categories = await service.getAll()
    res.json(categories)
  } catch (error) {
    next(error)
  }
}

async function getCategory(req, res, next) {
  try {
    const category = await service.getById(req.params.id)

    if (!category) {
      return res.status(404).json({
        mensaje: 'Categoría no encontrada'
      })
    }

    res.json(category)
  } catch (error) {
    next(error)
  }
}

async function createCategory(req, res, next) {
  try {
    const category = await service.create(req.body)
    res.status(201).json(category)
  } catch (error) {
    next(error)
  }
}

async function updateCategory(req, res, next) {
  try {
    const category = await service.update(req.params.id, req.body)

    if (!category) {
      return res.status(404).json({
        mensaje: 'Categoría no encontrada'
      })
    }

    res.json(category)
  } catch (error) {
    next(error)
  }
}

async function deactivateCategory(req, res, next) {
  try {
    const result = await service.deactivate(req.params.id)

    if (!result) {
      return res.status(404).json({
        mensaje: 'Categoría no encontrada'
      })
    }

    res.json({
      mensaje: 'Categoría desactivada correctamente'
    })
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