const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

function apiRole(dbRole) {
  return dbRole === 'gerente' ? 'manager' : 'employee';
}

router.get('/user/login', (req, res) => {
  res.json({
    message: 'Endpoint de login de usuarios internos disponible',
    metodo: 'Usa POST para iniciar sesión como gerente o empleado'
  });
});

// Ruta POST para login del sistema
router.post('/user/login', async (req, res) => {
  const { nombreUsuario, contrasena } = req.body;

  // Validar campos vacíos
  if (!nombreUsuario || !contrasena) {
    return res.status(400).json({ error: "El usuario y la contraseña son obligatorios." });
  }

  try {
    const result = await pool.query(
      'SELECT id, nombre_completo, usuario, password_hash, rol FROM restaurant_users WHERE lower(usuario) = lower($1) LIMIT 1',
      [nombreUsuario]
    );

    const usuario = result.rows[0];

    // Validar usuario
    if (!usuario) {
      return res.status(404).json({ error: "El usuario no existe." });
    }

    // Validar contraseña
    if (contrasena !== usuario.password_hash) {
      return res.status(401).json({ error: "Contraseña incorrecta." });
    }

    // Si todo está bien
    return res.status(200).json({
      message: "Login exitoso",
      usuario: {
        id: Number(usuario.id),
        nombreCompleto: usuario.nombre_completo,
        nombreUsuario: usuario.usuario,
        rol: apiRole(usuario.rol),
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo procesar el login de usuario interno.' });
  }
});

module.exports = router;