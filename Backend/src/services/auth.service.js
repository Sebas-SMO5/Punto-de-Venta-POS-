const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const usersRepository = require('../repositories/users.repository')

const login = async (username, password) => {
  if (!username || !password) {
    throw new Error('El usuario y la contraseña son obligatorios')
  }

  const user = await usersRepository.findByUsername(username)

  if (!user) {
    throw new Error('Credenciales incorrectas')
  }

  const passwordValid = await bcrypt.compare(password, user.password)

  if (!passwordValid) {
    throw new Error('Credenciales incorrectas')
  }

  if (user.active === false) {
    throw new Error('El usuario está desactivado')
  }

  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('Falta configurar JWT_SECRET en el archivo .env')
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    secret,
    {
      expiresIn: '8h'
    }
  )

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  }
}

module.exports = {
  login
}