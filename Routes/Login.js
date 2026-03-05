const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => {
  res.json({ 
    message: 'Endpoint de login disponible',
    metodo: 'Usa POST para iniciar sesión'
  });
});

// Usuario simulado (luego lo reemplazas por BD)
const fakeUser = {
  email: "contacto@laparrilla.com",
  password: "123456"
};

// Ruta POST para login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Validar campos vacíos
  if (!email || !password) {
    return res.status(400).json({ error: "Correo y contraseña son obligatorios." });
  }

  // Validar email
  if (email !== fakeUser.email) {
    return res.status(404).json({ error: "El correo no existe." });
  }

  // Validar contraseña
  if (password !== fakeUser.password) {
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }

  // Si todo está bien
  return res.status(200).json({
    message: "Login exitoso",
    user: {
      email: fakeUser.email
    }
  });
});

module.exports = router;