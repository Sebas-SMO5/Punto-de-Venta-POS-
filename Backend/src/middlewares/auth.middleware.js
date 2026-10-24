
export const authenticate = (req, res, next) => {
  const authorization = req.headers.authorization

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Autenticación requerida'
    })
  }

  return res.status(501).json({
    success: false,
    message: 'Autenticación pendiente de implementar'
  })
}
