// Arma la aplicación Express: el orden de los middlewares importa.
// Cada petición pasa, en orden, por:
//   1. correlationId  -> número de seguimiento + log de la petición
//   2. helmet         -> cabeceras de seguridad del navegador
//   3. cors           -> qué páginas pueden llamar a la API
//   4. json/cookies   -> lee el cuerpo JSON y las cookies
//   5. rate limit     -> límite de peticiones por minuto
//   6. rutas          -> /api/... (con autenticación y roles)
//   7. notFound/error -> 404 y manejador global de errores
// Esta separación (app.js vs server.js) permite probar la app sin
// encender el servidor de verdad.
const fs = require('fs')
const path = require('path')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')

const config = require('./config/env')
const correlationId = require('./middlewares/correlation.middleware')
const { apiLimiter } = require('./middlewares/rateLimit.middleware')
const notFound = require('./middlewares/notFound.middleware')
const errorHandler = require('./middlewares/error.middleware')
const apiRoutes = require('./routes')

const app = express()

// En la nube hay un "proxy" delante; esto permite ver la IP real del cliente
if (config.isProduction) app.set('trust proxy', 1)
app.disable('x-powered-by')

app.use(correlationId)
app.use(helmet())
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
    exposedHeaders: ['x-correlation-id']
  })
)
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

if (!config.isTest) app.use('/api', apiLimiter)

app.use('/api', apiRoutes)
app.use('/api', notFound)

// En producción el mismo servidor entrega la página web ya compilada
// (carpeta Frontend/dist). Así página y API están en el mismo dominio y la
// cookie SameSite=Strict funciona sin problemas.
const frontendDist = path.resolve(__dirname, '../../Frontend/dist')

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: false, maxAge: '1h' }))

  // Cualquier otra ruta (/sales, /products...) devuelve index.html y
  // Vue Router se encarga de mostrar la pantalla correcta.
  app.get(/^(?!\/api).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.use(errorHandler)

module.exports = app
