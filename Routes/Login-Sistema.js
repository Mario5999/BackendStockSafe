const express = require('express');
const router = express.Router();

router.get('/user/login', (req, res) => {
  res.json({
    message: 'Endpoint de login del sistema disponible',
    metodo: 'Usa POST para iniciar sesión en el sistema'
  });
});

// Usuario simulado (luego lo puedes reemplazar por BD)
const fakeUser = {
  nombreUsuario: "mario123",
  contrasena: "123456"
};

// Ruta POST para login del sistema
router.post('/user/login', (req, res) => {
  const { nombreUsuario, contrasena } = req.body;

  // Validar campos vacíos
  if (!nombreUsuario || !contrasena) {
    return res.status(400).json({ error: "El usuario y la contraseña son obligatorios." });
  }

  // Validar usuario
  if (nombreUsuario !== fakeUser.nombreUsuario) {
    return res.status(404).json({ error: "El usuario no existe." });
  }

  // Validar contraseña
  if (contrasena !== fakeUser.contrasena) {
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }

  // Si todo está bien
  return res.status(200).json({
    message: "Login exitoso",
    usuario: {
      nombreUsuario: fakeUser.nombreUsuario
    }
  });
});

module.exports = router;