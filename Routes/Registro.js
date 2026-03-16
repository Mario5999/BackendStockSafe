const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

function sanitizeRestaurant(restaurant) {
  return {
    id: Number(restaurant.id),
    restaurantName: restaurant.restaurant_name,
    address: restaurant.address,
    phone: restaurant.phone,
    email: restaurant.email,
    managerName: restaurant.manager_name,
    managerEmail: restaurant.manager_email,
    tokenRecuperacion: restaurant.reset_token || null,
    tokenExpira: restaurant.reset_token_expires_at
      ? new Date(restaurant.reset_token_expires_at).getTime()
      : null,
  };
}

// POST: registrar restaurante
router.post('/register', async (req, res) => {
  const {
    restaurantName,
    address,
    phone,
    email,
    password,
    confirmPassword,
    managerName,
    managerEmail
  } = req.body;

  if (
    !restaurantName ||
    !address ||
    !phone ||
    !email ||
    !password ||
    !confirmPassword ||
    !managerName ||
    !managerEmail
  ) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO restaurantes (
        restaurant_name,
        address,
        phone,
        email,
        password_hash,
        manager_name,
        manager_email
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [restaurantName, address, phone, email, password, managerName, managerEmail]
    );

    return res.status(201).json({
      message: 'Restaurante registrado correctamente.',
      data: sanitizeRestaurant(result.rows[0])
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un restaurante con ese correo o correo de gerente.' });
    }

    return res.status(500).json({ error: 'No se pudo registrar el restaurante.' });
  }
});

// GET: obtener todos los restaurantes
router.get('/register', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurantes ORDER BY id ASC');

    return res.status(200).json({
      message: "Lista de restaurantes registrados",
      data: result.rows.map(sanitizeRestaurant)
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo obtener la lista de restaurantes.' });
  }
});

// PUT: editar restaurante
router.put('/register/:id', async (req, res) => {
  const { id } = req.params;
  const {
    restaurantName,
    address,
    phone,
    email,
    managerName,
    managerEmail
  } = req.body;

  try {
    const currentResult = await pool.query('SELECT * FROM restaurantes WHERE id = $1', [id]);
    const current = currentResult.rows[0];

    if (!current) {
      return res.status(404).json({ error: 'El restaurante no existe.' });
    }

    const updatedResult = await pool.query(
      `UPDATE restaurantes
       SET
         restaurant_name = $1,
         address = $2,
         phone = $3,
         email = $4,
         manager_name = $5,
         manager_email = $6
       WHERE id = $7
       RETURNING *`,
      [
        restaurantName || current.restaurant_name,
        address || current.address,
        phone || current.phone,
        email || current.email,
        managerName || current.manager_name,
        managerEmail || current.manager_email,
        id,
      ]
    );

    return res.status(200).json({
      message: 'Restaurante actualizado correctamente.',
      data: sanitizeRestaurant(updatedResult.rows[0])
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'El correo del restaurante o del gerente ya existe.' });
    }

    return res.status(500).json({ error: 'No se pudo actualizar el restaurante.' });
  }
});

// DELETE: eliminar restaurante
router.delete('/register/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await pool.query('DELETE FROM restaurantes WHERE id = $1 RETURNING *', [id]);

    if (!deleted.rows[0]) {
      return res.status(404).json({ error: 'El restaurante no existe.' });
    }

    return res.status(200).json({
      message: 'Restaurante eliminado correctamente.',
      data: sanitizeRestaurant(deleted.rows[0])
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo eliminar el restaurante.' });
  }
});

module.exports = router;