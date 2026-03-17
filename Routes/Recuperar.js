const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../db/pool');
const { hashPassword, isStrongPassword } = require('../utils/security');

async function findRestaurantByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const result = await pool.query(
    'SELECT id, email, reset_token, reset_token_expires_at FROM restaurantes WHERE lower(email) = $1 LIMIT 1',
    [normalizedEmail]
  );
  return result.rows[0] || null;
}

async function findRestaurantByToken(token) {
  const result = await pool.query(
    `SELECT id, email, reset_token, reset_token_expires_at
     FROM restaurantes
     WHERE reset_token = $1
       AND reset_token_expires_at IS NOT NULL
       AND reset_token_expires_at > NOW()
     LIMIT 1`,
    [token]
  );

  return result.rows[0] || null;
}

function hasActiveRecoveryToken(restaurant) {
  if (!restaurant || !restaurant.reset_token || !restaurant.reset_token_expires_at) {
    return false;
  }

  return new Date(restaurant.reset_token_expires_at).getTime() > Date.now();
}

// 1️⃣ Solicitar recuperación (genera token y envía correo)
router.post('/recuperar/solicitar', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'El correo es obligatorio.' });
  }

  try {
    const restaurante = await findRestaurantByEmail(email);

    if (!restaurante) {
      return res.status(404).json({ error: "El correo no está registrado." });
    }

    // Generar token seguro
    const token = crypto.randomBytes(20).toString('hex');

    // Guardar token y expiración (15 minutos)
    await pool.query(
      `UPDATE restaurantes
       SET reset_token = $1,
           reset_token_expires_at = NOW() + INTERVAL '15 minutes'
       WHERE id = $2`,
      [token, restaurante.id]
    );

    return res.status(200).json({
      message: 'Token Generado Correctamente'
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo generar el token de recuperación.' });
  }
});

// 2️⃣ Validar token (cuando el usuario abre la vista del frontend)
router.get('/recuperar/validar/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const restaurante = await findRestaurantByToken(token);

    if (!restaurante) {
      return res.status(400).json({ error: "Token inválido o expirado." });
    }

    return res.status(200).json({ message: "Token válido." });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo validar el token.' });
  }
});

// 2.1) Validación interna por correo (sin exponer token)
router.post('/recuperar/interno/validar', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'El correo es obligatorio.' });
  }

  try {
    const restaurante = await findRestaurantByEmail(email);

    if (!restaurante) {
      return res.status(404).json({ error: 'El correo no está registrado.' });
    }

    if (!hasActiveRecoveryToken(restaurante)) {
      return res.status(400).json({ error: 'No hay un token activo para este correo o ya expiró.' });
    }

    return res.status(200).json({ message: 'Token válido. Puedes cambiar la contraseña.' });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo validar el token interno.' });
  }
});

// 3️⃣ Cambiar contraseña
router.post('/recuperar/cambiar', async (req, res) => {
  const { token, nuevaPassword } = req.body;

  if (!nuevaPassword) {
    return res.status(400).json({ error: 'La nueva contraseña es obligatoria.' });
  }

  if (!isStrongPassword(nuevaPassword)) {
    return res.status(400).json({
      error: 'La contrasena debe tener al menos 8 caracteres, con una mayuscula, una minuscula, un numero y un simbolo.',
    });
  }

  try {
    const restaurante = await findRestaurantByToken(token);

    if (!restaurante) {
      return res.status(400).json({ error: "Token inválido o expirado." });
    }

    const passwordHash = await hashPassword(nuevaPassword);

    await pool.query(
      `UPDATE restaurantes
       SET password_hash = $1,
           reset_token = NULL,
           reset_token_expires_at = NULL
       WHERE id = $2`,
      [passwordHash, restaurante.id]
    );

    return res.status(200).json({ message: "Contraseña actualizada correctamente." });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña.' });
  }
});

// 3.1) Cambio interno por correo (requiere token activo en backend)
router.post('/recuperar/interno/cambiar', async (req, res) => {
  const { email, nuevaPassword } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'El correo es obligatorio.' });
  }

  if (!nuevaPassword) {
    return res.status(400).json({ error: 'La nueva contraseña es obligatoria.' });
  }

  if (!isStrongPassword(nuevaPassword)) {
    return res.status(400).json({
      error: 'La contrasena debe tener al menos 8 caracteres, con una mayuscula, una minuscula, un numero y un simbolo.',
    });
  }

  try {
    const restaurante = await findRestaurantByEmail(email);

    if (!restaurante) {
      return res.status(404).json({ error: 'El correo no está registrado.' });
    }

    if (!hasActiveRecoveryToken(restaurante)) {
      return res.status(400).json({ error: 'No hay un token activo para este correo o ya expiró.' });
    }

    const passwordHash = await hashPassword(nuevaPassword);

    await pool.query(
      `UPDATE restaurantes
       SET password_hash = $1,
           reset_token = NULL,
           reset_token_expires_at = NULL
       WHERE id = $2`,
      [passwordHash, restaurante.id]
    );

    return res.status(200).json({ message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña.' });
  }
});

module.exports = router;