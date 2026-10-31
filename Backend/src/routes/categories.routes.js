const express = require('express')
const router = express.Router()

const controller = require('../controllers/categories.controller')

router.get('/', controller.getCategories)
router.get('/:id', controller.getCategory)
router.post('/', controller.createCategory)
router.put('/:id', controller.updateCategory)
router.delete('/:id', controller.deactivateCategory)

module.exports = router