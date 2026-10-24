
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const productsRoutes = require('./routes/products.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    mensaje: 'Backend del POS funcionando correctamente',
    estado: 'OK'
  });
});

app.use('/api/products', productsRoutes);

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    mensaje: err.status ? err.message : 'Error interno del servidor'
  });
});

app.listen(PORT, () => {
  console.log(`Backend ejecutándose en http://localhost:${PORT}`);
});