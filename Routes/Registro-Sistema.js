const express = require('express');
const router = express.Router();

// Ruta GET para verificar que el endpoint está disponible
router.get('/user/register', (req, res) => {
  res.json({
    message: 'Endpoint de registro del sistema disponible',
    metodo: 'Usa POST para registrar un usuario del sistema'
  });
});

// Ruta POST para registrar usuarios del sistema
router.post('/user/register', (req, res) => {
  const {
    nombreCompleto,
    nombreUsuario,
    contrasena,
    confirmarContrasena
  } = req.body;

  // Validar campos vacíos
  if (!nombreCompleto || !nombreUsuario || !contrasena || !confirmarContrasena) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  // Validar contraseñas
  if (contrasena !== confirmarContrasena) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
  }

  // Crear objeto del nuevo usuario
  const nuevoUsuario = {
    nombreCompleto,
    nombreUsuario
  };

  return res.status(201).json({
    message: 'Usuario del sistema registrado correctamente.',
    data: nuevoUsuario
  });
});

module.exports = router;