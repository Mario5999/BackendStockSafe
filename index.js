const express = require('express');
const app = express();
const PORT = 4000;
const { checkDbConnection } = require('./db/pool');

// Importar rutas
const registroRoutes = require('./Routes/Registro.js');
const loginRoutes = require('./Routes/Login.js');
const registrosystemRoutes = require('./Routes/Registro-Sistema.js');
const loginsystemRoutes = require('./Routes/Login-Sistema.js');
const seccionRoutes = require('./Routes/Seccion.js');
const productoRoutes = require('./Routes/Producto.js');
const inventoryRoutes = require('./Routes/Inventory.js');
const recoverpassword = require('./Routes/Recuperar.js');
const generatepdf = require('./Routes/GenerarPDF.js');

app.use(express.json());

app.get('/api/health/db', async (req, res) => {
  try {
    await checkDbConnection();
    return res.status(200).json({ ok: true, message: 'PostgreSQL disponible.' });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      message: 'No se pudo conectar a PostgreSQL.',
      error: error.message,
    });
  }
});

// Usar rutas
app.use('/api', registroRoutes);
app.use('/api', loginRoutes);
app.use('/api', registrosystemRoutes);
app.use('/api', loginsystemRoutes);
app.use('/api', recoverpassword);
app.use('/api', seccionRoutes);
app.use('/api', productoRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', generatepdf);

app.get('/', (req, res) => {
  res.send('¡Backend funcionando correctamente!');
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;