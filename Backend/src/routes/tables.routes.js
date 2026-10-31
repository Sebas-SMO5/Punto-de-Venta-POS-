const express = require('express')
const router = express.Router()
const tablesController = require('../controllers/tables.controller')

router.get('/', tablesController.getTables)
router.get('/:id', tablesController.getTableById)

module.exports = router