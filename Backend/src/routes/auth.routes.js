const { Router } = require('express')
const { login, getProfile } = require('../controllers/auth.controller')
const { authenticate } = require('../middlewares/auth.middleware')

const router = Router()

router.post('/login', login)
router.get('/profile', authenticate, getProfile)

module.exports = router
