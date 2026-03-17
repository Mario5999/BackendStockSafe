const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { getDefaultRestaurantId, getDefaultRestaurantUserId } = require('../db/context');
const { authenticateToken, requireRoles, getScopedRestaurantId } = require('../middleware/auth');

function mapProduct(product) {
  return {
    id: Number(product.id),
    nombre: product.nombre,
    categoria: product.categoria,
    cantidad: Number(product.cantidad),
    unidad: product.unidad,
    stockMinimo: Number(product.stock_minimo),
    stockMaximo: Number(product.stock_maximo),
    stockInicial: Number(product.cantidad),
    entradas: Number(product.entradas ?? 0),
    salidas: Number(product.salidas ?? 0),
  };
}

function emptyDashboardIndicators() {
  return {
    totalItems: 0,
    stockBajo: 0,
    excedentes: 0,
    sinStock: 0,
    actualizaciones: 0,
  };
}

async function resolveRestaurantId(req, options = {}) {
  let restauranteId = getScopedRestaurantId(req, {
    queryValue: options.queryValue,
    bodyValue: options.bodyValue,
  });

  if (!restauranteId && req.auth?.role === 'admin') {
    restauranteId = await getDefaultRestaurantId();
  }

  return restauranteId;
}

router.use(authenticateToken);

router.get('/dashboard/indicators', requireRoles('admin', 'restaurant', 'manager', 'employee'), async (req, res) => {
  const requestedRestaurantId = Number(req.query.restauranteId);

  try {
    let restauranteId = await resolveRestaurantId(req, { queryValue: requestedRestaurantId });

    if (!restauranteId) {
      return res.status(200).json({
        message: 'Indicadores del dashboard',
        data: emptyDashboardIndicators(),
      });
    }

    const indicatorsResult = await pool.query(
      `SELECT
         COALESCE((
           SELECT COUNT(*)
           FROM products p
           WHERE p.restaurante_id = $1
         ), 0)::int AS total_items,
         COALESCE((
           SELECT COUNT(*)
           FROM products p
           WHERE p.restaurante_id = $1
             AND p.cantidad < p.stock_minimo
             AND p.cantidad > 0
         ), 0)::int AS stock_bajo,
         COALESCE((
           SELECT COUNT(*)
           FROM products p
           WHERE p.restaurante_id = $1
             AND p.cantidad > p.stock_maximo
         ), 0)::int AS excedentes,
         COALESCE((
           SELECT COUNT(*)
           FROM products p
           WHERE p.restaurante_id = $1
             AND p.cantidad = 0
         ), 0)::int AS sin_stock,
         (
           COALESCE((
             SELECT COUNT(*)
             FROM inventory_movements m
             JOIN products p ON p.id = m.product_id
             WHERE p.restaurante_id = $1
           ), 0)
           +
           COALESCE((
             SELECT COUNT(*)
             FROM inventory_checks c
             JOIN products p ON p.id = c.product_id
             WHERE p.restaurante_id = $1
           ), 0)
         )::int AS actualizaciones`,
      [restauranteId]
    );

    const indicators = indicatorsResult.rows[0];

    return res.status(200).json({
      message: 'Indicadores del dashboard',
      data: {
        totalItems: Number(indicators.total_items || 0),
        stockBajo: Number(indicators.stock_bajo || 0),
        excedentes: Number(indicators.excedentes || 0),
        sinStock: Number(indicators.sin_stock || 0),
        actualizaciones: Number(indicators.actualizaciones || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudieron obtener los indicadores del dashboard.' });
  }
});

// Verificar inventario
router.post('/inventory/check', requireRoles('admin', 'restaurant', 'manager', 'employee'), async (req, res) => {
  const { productId, cantidadFisica } = req.body;

  const fisico = Number(cantidadFisica);
  if (Number.isNaN(fisico) || fisico < 0) {
    return res.status(400).json({ error: 'La cantidad física debe ser un número válido.' });
  }

  try {
    const restauranteId = await resolveRestaurantId(req, { bodyValue: req.body.restauranteId });
    if (!restauranteId) {
      return res.status(404).json({ error: "Producto no encontrado." });
    }

    const productResult = await pool.query(
      'SELECT id, cantidad FROM products WHERE id = $1 AND restaurante_id = $2 LIMIT 1',
      [productId, restauranteId]
    );

    const producto = productResult.rows[0];

    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado." });
    }

    const sistema = Number(producto.cantidad);
    const diferencia = sistema - fisico;

    const restaurantUserId = await getDefaultRestaurantUserId(restauranteId);
    if (restaurantUserId) {
      await pool.query(
        `INSERT INTO inventory_checks (
          product_id,
          restaurant_user_id,
          cantidad_sistema,
          cantidad_fisica,
          diferencia
        ) VALUES ($1, $2, $3, $4, $5)`,
        [productId, restaurantUserId, sistema, fisico, diferencia]
      );
    }

    if (diferencia === 0) {
      return res.status(200).json({
        status: "ok",
        message: "Inventario correcto",
        sistema,
        fisico,
        diferencia: 0
      });
    }

    return res.status(200).json({
      status: "error",
      message: "Diferencia detectada",
      sistema,
      fisico,
      diferencia
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo verificar el inventario.' });
  }
});

// PUT: actualizar solo la cantidad de un producto
router.put('/products/:id/cantidad', requireRoles('admin', 'restaurant', 'manager', 'employee'), async (req, res) => {
  const { id } = req.params;
  const { cantidad } = req.body;

  if (cantidad === undefined) {
    return res.status(400).json({ error: "La cantidad es obligatoria." });
  }

  const nuevaCantidad = Number(cantidad);
  if (Number.isNaN(nuevaCantidad) || nuevaCantidad < 0) {
    return res.status(400).json({ error: "La cantidad debe ser un número válido mayor o igual a 0." });
  }

  try {
    const restauranteId = await resolveRestaurantId(req, { bodyValue: req.body.restauranteId });
    if (!restauranteId) {
      return res.status(404).json({ error: "Producto no encontrado." });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query(
        `SELECT p.id, p.nombre, s.nombre AS categoria, p.cantidad, p.unidad, p.stock_minimo, p.stock_maximo
         FROM products p
         JOIN sections s ON s.id = p.section_id
         WHERE p.id = $1 AND p.restaurante_id = $2
         FOR UPDATE`,
        [id, restauranteId]
      );

      const current = currentResult.rows[0];
      if (!current) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Producto no encontrado." });
      }

      const cantidadAnterior = Number(current.cantidad);
      const diferencia = nuevaCantidad - cantidadAnterior;

      const updatedResult = await client.query(
        `UPDATE products
         SET cantidad = $1
         WHERE id = $2 AND restaurante_id = $3
         RETURNING id, nombre, cantidad, unidad, stock_minimo, stock_maximo`,
        [nuevaCantidad, id, restauranteId]
      );

      let entradas = 0;
      let salidas = 0;
      if (diferencia > 0) {
        entradas = diferencia;
      } else if (diferencia < 0) {
        salidas = Math.abs(diferencia);
      }

      if (diferencia !== 0) {
        const restaurantUserId = await getDefaultRestaurantUserId(restauranteId, client);
        if (restaurantUserId) {
          await client.query(
            `INSERT INTO inventory_movements (
              product_id,
              restaurant_user_id,
              movement_type,
              quantity,
              previous_quantity,
              new_quantity,
              note
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              id,
              restaurantUserId,
              diferencia > 0 ? 'entry' : 'exit',
              Math.abs(diferencia),
              cantidadAnterior,
              nuevaCantidad,
              'Actualizacion manual de cantidad desde API',
            ]
          );
        }
      }

      await client.query('COMMIT');

      return res.status(200).json({
        message: "Cantidad actualizada correctamente.",
        data: mapProduct({
          ...updatedResult.rows[0],
          categoria: current.categoria,
          entradas,
          salidas,
        })
      });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'No se pudo actualizar la cantidad del producto.' });
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo actualizar la cantidad del producto.' });
  }
});

module.exports = router;