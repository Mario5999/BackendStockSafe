const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { signAccessToken } = require('../utils/jwt');
const { hashPassword, verifyPassword } = require('../utils/security');

router.get('/login', (req, res) => {
  res.json({ 
    message: 'Endpoint de login disponible',
    metodo: 'Usa POST para iniciar sesión'
  });
});

// Ruta POST para login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validar campos vacíos
  if (!email || !password) {
    return res.status(400).json({ error: "Correo y contraseña son obligatorios." });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, restaurant_name, password_hash FROM restaurantes WHERE lower(email) = lower($1) LIMIT 1',
      [email]
    );

    const restaurante = result.rows[0];

    // Validar email
    if (!restaurante) {
      return res.status(404).json({ error: "El correo no existe." });
    }

    const passwordCheck = await verifyPassword(password, restaurante.password_hash);
    if (!passwordCheck.match) {
      return res.status(401).json({ error: "Contraseña incorrecta." });
    }

    if (passwordCheck.needsRehash) {
      const newHash = await hashPassword(password);
      await pool.query('UPDATE restaurantes SET password_hash = $1 WHERE id = $2', [newHash, restaurante.id]);
    }

    const token = signAccessToken({
      sub: Number(restaurante.id),
      role: 'restaurant',
      restauranteId: Number(restaurante.id),
      email: restaurante.email,
    });

    // Si todo está bien
    return res.status(200).json({
      message: "Login exitoso",
      token,
      user: {
        id: Number(restaurante.id),
        email: restaurante.email,
        restaurantName: restaurante.restaurant_name,
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo procesar el login.' });
  }
});

// Login del administrador global (system_users)
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Correo y contraseña son obligatorios." });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash FROM system_users WHERE lower(email) = lower($1) LIMIT 1',
      [email]
    );

    const admin = result.rows[0];

    if (!admin) {
      return res.status(404).json({ error: "El correo no existe." });
    }

    const passwordCheck = await verifyPassword(password, admin.password_hash);
    if (!passwordCheck.match) {
      return res.status(401).json({ error: "Contraseña incorrecta." });
    }

    if (passwordCheck.needsRehash) {
      const newHash = await hashPassword(password);
      await pool.query('UPDATE system_users SET password_hash = $1 WHERE id = $2', [newHash, admin.id]);
    }

    const token = signAccessToken({
      sub: Number(admin.id),
      role: 'admin',
      email: admin.email,
    });

    return res.status(200).json({
      message: "Login exitoso",
      token,
      admin: {
        id: Number(admin.id),
        email: admin.email,
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo procesar el login de administrador.' });
  }
});

module.exports = router;