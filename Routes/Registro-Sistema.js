const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { getDefaultRestaurantId } = require('../db/context');
const { authenticateToken, requireRoles, getScopedRestaurantId } = require('../middleware/auth');
const { hashPassword } = require('../utils/security');

function normalizeRole(rol) {
  const value = String(rol || '').trim().toLowerCase();

  if (value === 'manager' || value === 'gerente') {
    return 'gerente';
  }

  if (value === 'employee' || value === 'empleado') {
    return 'empleado';
  }

  return null;
}

function apiRole(dbRole) {
  return dbRole === 'gerente' ? 'manager' : 'employee';
}

function mapRestaurantUser(row) {
  return {
    id: Number(row.id),
    restauranteId: Number(row.restaurante_id),
    nombreCompleto: row.nombre_completo,
    nombreUsuario: row.usuario,
    rol: apiRole(row.rol),
  };
}

// Ruta GET para verificar que el endpoint está disponible
router.get('/user/register', (req, res) => {
  res.json({
    message: 'Endpoint de registro de usuarios internos disponible',
    metodo: 'Usa POST para registrar gerente o empleado del restaurante'
  });
});

router.get('/user/users', authenticateToken, requireRoles('admin', 'restaurant', 'manager', 'employee'), async (req, res) => {

  try {
    let restauranteId = getScopedRestaurantId(req, { queryValue: req.query.restauranteId });

    if (!restauranteId && req.auth?.role === 'admin') {
      restauranteId = await getDefaultRestaurantId(pool);
    }

    if (!restauranteId) {
      return res.status(200).json({
        message: 'Lista de usuarios internos',
        data: [],
      });
    }

    const users = await pool.query(
      `SELECT id, restaurante_id, nombre_completo, usuario, rol
       FROM restaurant_users
       WHERE restaurante_id = $1
       ORDER BY
         CASE WHEN rol = 'gerente' THEN 0 ELSE 1 END,
         id ASC`,
      [restauranteId]
    );

    return res.status(200).json({
      message: 'Lista de usuarios internos',
      data: users.rows.map(mapRestaurantUser),
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo obtener la lista de usuarios internos.' });
  }
});

// Ruta POST para registrar usuarios del sistema
router.post('/user/register', authenticateToken, requireRoles('admin', 'restaurant', 'manager'), async (req, res) => {
  const {
    restauranteId,
    nombreCompleto,
    nombreUsuario,
    contrasena,
    confirmarContrasena,
    rol,
  } = req.body;

  // Validar campos vacíos
  if (!nombreCompleto || !nombreUsuario || !contrasena || !confirmarContrasena) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  // Validar contraseñas
  if (contrasena !== confirmarContrasena) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
  }

  const normalizedRole = normalizeRole(rol);
  if (!normalizedRole) {
    return res.status(400).json({ error: 'Rol invalido. Usa manager o employee.' });
  }

  try {
    let targetRestaurantId = getScopedRestaurantId(req, { bodyValue: restauranteId });

    if (!targetRestaurantId && req.auth?.role === 'admin') {
      targetRestaurantId = await getDefaultRestaurantId(pool);
    }

    if (!targetRestaurantId) {
      return res.status(400).json({ error: 'No existe un restaurante disponible para asignar el usuario.' });
    }

    const existingRestaurant = await pool.query('SELECT id FROM restaurantes WHERE id = $1 LIMIT 1', [targetRestaurantId]);
    if (!existingRestaurant.rows[0]) {
      return res.status(404).json({ error: 'El restaurante indicado no existe.' });
    }

    const passwordHash = await hashPassword(contrasena);

    const created = await pool.query(
      `INSERT INTO restaurant_users (restaurante_id, nombre_completo, usuario, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, restaurante_id, nombre_completo, usuario, rol`,
      [targetRestaurantId, nombreCompleto, nombreUsuario, passwordHash, normalizedRole]
    );

    const row = created.rows[0];

    return res.status(201).json({
      message: 'Usuario interno registrado correctamente.',
      data: {
        id: Number(row.id),
        restauranteId: Number(row.restaurante_id),
        nombreCompleto: row.nombre_completo,
        nombreUsuario: row.usuario,
        rol: apiRole(row.rol),
      }
    });
  } catch (error) {
    if (error.code === '23505') {
      if (error.constraint === 'restaurant_users_usuario_key') {
        return res.status(409).json({ error: 'El nombre de usuario ya existe.' });
      }

      if (error.constraint === 'restaurant_users_restaurante_id_rol_key') {
        return res.status(409).json({ error: 'Ya existe un usuario para ese rol en este restaurante.' });
      }

      return res.status(409).json({ error: 'No se pudo registrar el usuario por conflicto de datos unicos.' });
    }

    return res.status(500).json({ error: 'No se pudo registrar el usuario interno.' });
  }
});

module.exports = router;