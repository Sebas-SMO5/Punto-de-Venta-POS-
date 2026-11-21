const authService = require('../services/auth.service')
const usersRepository = require('../repositories/users.repository')

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body || {}
    const result = await authService.login(username, password)

    res.json(result)
  } catch (error) {
    if (error.message === 'Falta configurar JWT_SECRET en el archivo .env') {
      return next(error)
    }

    res.status(401).json({ mensaje: error.message })
  }
}

const getProfile = async (req, res, next) => {
  try {
    const user = await usersRepository.findById(req.user.id)

    if (!user) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' })
    }

    res.json(user)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  login,
  getProfile
}
