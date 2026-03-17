const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { getDefaultRestaurantId } = require('../db/context');
const { authenticateToken, requireRoles, getScopedRestaurantId } = require('../middleware/auth');

function mapSection(section) {
  return {
    id: Number(section.id),
    nombre: section.nombre,
  };
}

async function resolveRestaurantId(req) {
  let restauranteId = getScopedRestaurantId(req, { queryValue: req.query.restauranteId });

  if (!restauranteId && req.auth?.role === 'admin') {
    restauranteId = await getDefaultRestaurantId();
  }

  return restauranteId;
}

router.use(authenticateToken);

// Crear sección
router.post('/sections', requireRoles('admin', 'restaurant', 'manager'), async (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: "El nombre de la sección es obligatorio." });
  }

  try {
    const restauranteId = await resolveRestaurantId(req);
    if (!restauranteId) {
      return res.status(400).json({ error: 'No existe un restaurante configurado para crear secciones.' });
    }

    const created = await pool.query(
      'INSERT INTO sections (restaurante_id, nombre) VALUES ($1, $2) RETURNING id, nombre',
      [restauranteId, nombre]
    );

    return res.status(201).json({
      message: "Sección creada correctamente.",
      data: mapSection(created.rows[0])
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una sección con ese nombre.' });
    }

    return res.status(500).json({ error: 'No se pudo crear la sección.' });
  }
});

// Obtener todas las secciones
router.get('/sections', requireRoles('admin', 'restaurant', 'manager', 'employee'), async (req, res) => {
  try {
    const restauranteId = await resolveRestaurantId(req);
    if (!restauranteId) {
      return res.status(200).json({ message: 'Lista de secciones', data: [] });
    }

    const result = await pool.query(
      'SELECT id, nombre FROM sections WHERE restaurante_id = $1 ORDER BY id ASC',
      [restauranteId]
    );

    return res.status(200).json({
      message: "Lista de secciones",
      data: result.rows.map(mapSection)
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo obtener la lista de secciones.' });
  }
});

// Editar sección por ID
router.put('/sections/:id', requireRoles('admin', 'restaurant', 'manager'), async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;

  try {
    const restauranteId = await resolveRestaurantId(req);
    if (!restauranteId) {
      return res.status(404).json({ error: "La sección no existe." });
    }

    const current = await pool.query('SELECT id, nombre FROM sections WHERE id = $1 AND restaurante_id = $2', [id, restauranteId]);
    if (!current.rows[0]) {
      return res.status(404).json({ error: "La sección no existe." });
    }

    const updated = await pool.query(
      'UPDATE sections SET nombre = $1 WHERE id = $2 AND restaurante_id = $3 RETURNING id, nombre',
      [nombre || current.rows[0].nombre, id, restauranteId]
    );

    return res.status(200).json({
      message: "Sección actualizada correctamente.",
      data: mapSection(updated.rows[0])
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una sección con ese nombre.' });
    }

    return res.status(500).json({ error: 'No se pudo actualizar la sección.' });
  }
});

// Eliminar sección
router.delete('/sections/:id', requireRoles('admin', 'restaurant', 'manager'), async (req, res) => {
  const { id } = req.params;

  try {
    const restauranteId = await resolveRestaurantId(req);
    if (!restauranteId) {
      return res.status(404).json({ error: "La sección no existe." });
    }

    const deleted = await pool.query(
      'DELETE FROM sections WHERE id = $1 AND restaurante_id = $2 RETURNING id, nombre',
      [id, restauranteId]
    );

    if (!deleted.rows[0]) {
      return res.status(404).json({ error: "La sección no existe." });
    }

    return res.status(200).json({
      message: "Sección eliminada correctamente.",
      data: mapSection(deleted.rows[0])
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar la sección porque tiene productos asociados.' });
    }

    return res.status(500).json({ error: 'No se pudo eliminar la sección.' });
  }
});

module.exports = router;