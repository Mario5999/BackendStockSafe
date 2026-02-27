const express = require('express');
const app = express();
const PORT = 4000;

// Importar rutas
const registroRoutes = require('./Routes/Registro.js');
const loginRoutes = require('./Routes/Login.js');
const registrosystemRoutes = require('./Routes/Registro-Sistema.js');
const loginsystemRoutes = require('./Routes/Login-Sistema.js');
const seccionRoutes = require('./Routes/Seccion.js');
const productoRoutes = require('./Routes/Producto.js');

app.use(express.json());

// Usar rutas
app.use('/api', registroRoutes);
app.use('/api', loginRoutes);
app.use('/api', registrosystemRoutes);
app.use('/api', loginsystemRoutes);
app.use('/api', seccionRoutes);
app.use('/api', productoRoutes);

app.get('/', (req, res) => {
  res.send('¡Backend funcionando correctamente!');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});