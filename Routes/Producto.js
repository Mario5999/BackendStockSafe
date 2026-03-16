const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { getDefaultRestaurantId } = require('../db/context');

function toNumber(value) {
  return Number(value);
}

function mapProduct(product) {
  return {
    id: toNumber(product.id),
    nombre: product.nombre,
    categoria: product.categoria,
    cantidad: toNumber(product.cantidad),
    unidad: product.unidad,
    stockMinimo: toNumber(product.stock_minimo),
    stockMaximo: toNumber(product.stock_maximo),
    stockInicial: toNumber(product.stock_inicial ?? product.cantidad),
    entradas: toNumber(product.entradas ?? 0),
    salidas: toNumber(product.salidas ?? 0),
    diferenciaVerificacion: toNumber(product.diferencia_verificacion ?? 0),
  };
}

async function resolveRestaurantId(queryRestaurantId) {
  const requestedRestaurantId = Number(queryRestaurantId);
  if (Number.isInteger(requestedRestaurantId) && requestedRestaurantId > 0) {
    return requestedRestaurantId;
  }

  return getDefaultRestaurantId();
}

// Crear producto
router.post('/products', async (req, res) => {
  const { nombre, categoria, cantidad, unidad, stockMinimo, stockMaximo, stockExcedente } = req.body;
  const maximo = Number(stockMaximo ?? stockExcedente);
  const cantidadNumero = Number(cantidad);
  const stockMinimoNumero = Number(stockMinimo);

  // Validación
  if (!nombre || !categoria || cantidad === undefined || !unidad || stockMinimo === undefined || Number.isNaN(maximo)) {
    return res.status(400).json({
      error: "Todos los campos son obligatorios: nombre, categoría, cantidad, unidad, stock mínimo y stock máximo."
    });
  }

  if (Number.isNaN(cantidadNumero) || Number.isNaN(stockMinimoNumero)) {
    return res.status(400).json({ error: 'Cantidad y stock mínimo deben ser numéricos.' });
  }

  if (maximo < stockMinimoNumero) {
    return res.status(400).json({
      error: "El stock máximo debe ser mayor o igual al stock mínimo."
    });
  }

  try {
    const restauranteId = await getDefaultRestaurantId();
    if (!restauranteId) {
      return res.status(400).json({ error: 'No existe un restaurante configurado para crear productos.' });
    }

    const sectionResult = await pool.query(
      'SELECT id FROM sections WHERE restaurante_id = $1 AND lower(nombre) = lower($2) LIMIT 1',
      [restauranteId, categoria]
    );

    const section = sectionResult.rows[0];
    if (!section) {
      return res.status(400).json({ error: 'La sección seleccionada no existe.' });
    }

    const created = await pool.query(
      `INSERT INTO products (
        restaurante_id,
        section_id,
        nombre,
        cantidad,
        unidad,
        stock_minimo,
        stock_maximo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, nombre, cantidad, unidad, stock_minimo, stock_maximo`,
      [restauranteId, section.id, nombre, cantidadNumero, unidad, stockMinimoNumero, maximo]
    );

    return res.status(201).json({
      message: "Producto creado correctamente.",
      data: mapProduct({
        ...created.rows[0],
        categoria,
        entradas: 0,
        salidas: 0,
      })
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo crear el producto.' });
  }
});

// Obtener todos los productos
router.get('/products', async (req, res) => {
  try {
    const restauranteId = await resolveRestaurantId(req.query.restauranteId);
    if (!restauranteId) {
      return res.status(200).json({ message: 'Lista de productos', data: [] });
    }

    const result = await pool.query(
      `SELECT
         p.id,
         p.nombre,
         s.nombre AS categoria,
         p.cantidad,
         p.unidad,
         p.stock_minimo,
         p.stock_maximo,
         p.cantidad AS stock_inicial,
         COALESCE(SUM(CASE WHEN m.movement_type = 'entry' THEN m.quantity ELSE 0 END), 0) AS entradas,
         COALESCE(SUM(CASE WHEN m.movement_type = 'exit' THEN m.quantity ELSE 0 END), 0) AS salidas,
         COALESCE(last_check.diferencia, 0) AS diferencia_verificacion
       FROM products p
       JOIN sections s ON s.id = p.section_id
       LEFT JOIN inventory_movements m ON m.product_id = p.id
       LEFT JOIN LATERAL (
         SELECT c.diferencia
         FROM inventory_checks c
         WHERE c.product_id = p.id
         ORDER BY c.checked_at DESC, c.id DESC
         LIMIT 1
       ) last_check ON TRUE
       WHERE p.restaurante_id = $1
       GROUP BY p.id, p.nombre, s.nombre, p.cantidad, p.unidad, p.stock_minimo, p.stock_maximo, last_check.diferencia
       ORDER BY p.id ASC`,
      [restauranteId]
    );

    return res.status(200).json({
      message: "Lista de productos",
      data: result.rows.map(mapProduct)
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo obtener la lista de productos.' });
  }
});

// Editar producto
router.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, categoria, cantidad, unidad, stockMinimo, stockMaximo, stockExcedente } = req.body;

  try {
    const restauranteId = await getDefaultRestaurantId();
    if (!restauranteId) {
      return res.status(404).json({ error: "El producto no existe." });
    }

    const currentResult = await pool.query(
      `SELECT p.id, p.nombre, p.cantidad, p.unidad, p.stock_minimo, p.stock_maximo, p.section_id,
              s.nombre AS categoria
       FROM products p
       JOIN sections s ON s.id = p.section_id
       WHERE p.id = $1 AND p.restaurante_id = $2`,
      [id, restauranteId]
    );

    const current = currentResult.rows[0];
    if (!current) {
      return res.status(404).json({ error: "El producto no existe." });
    }

    let sectionId = current.section_id;
    let categoriaFinal = current.categoria;
    if (categoria) {
      const sectionResult = await pool.query(
        'SELECT id, nombre FROM sections WHERE restaurante_id = $1 AND lower(nombre) = lower($2) LIMIT 1',
        [restauranteId, categoria]
      );

      const section = sectionResult.rows[0];
      if (!section) {
        return res.status(400).json({ error: 'La sección seleccionada no existe.' });
      }

      sectionId = section.id;
      categoriaFinal = section.nombre;
    }

    const cantidadFinal = cantidad !== undefined ? Number(cantidad) : Number(current.cantidad);
    const stockMinimoFinal = stockMinimo !== undefined ? Number(stockMinimo) : Number(current.stock_minimo);
    const stockMaximoPayload = stockMaximo ?? stockExcedente;
    const stockMaximoFinal = stockMaximoPayload !== undefined ? Number(stockMaximoPayload) : Number(current.stock_maximo);

    if ([cantidadFinal, stockMinimoFinal, stockMaximoFinal].some((value) => Number.isNaN(value))) {
      return res.status(400).json({ error: 'Cantidad y stocks deben ser valores numéricos válidos.' });
    }

    if (stockMaximoFinal < stockMinimoFinal) {
      return res.status(400).json({ error: "El stock máximo debe ser mayor o igual al stock mínimo." });
    }

    const updated = await pool.query(
      `UPDATE products
       SET
         nombre = $1,
         section_id = $2,
         cantidad = $3,
         unidad = $4,
         stock_minimo = $5,
         stock_maximo = $6
       WHERE id = $7 AND restaurante_id = $8
       RETURNING id, nombre, cantidad, unidad, stock_minimo, stock_maximo`,
      [
        nombre || current.nombre,
        sectionId,
        cantidadFinal,
        unidad || current.unidad,
        stockMinimoFinal,
        stockMaximoFinal,
        id,
        restauranteId,
      ]
    );

    return res.status(200).json({
      message: "Producto actualizado correctamente.",
      data: mapProduct({
        ...updated.rows[0],
        categoria: categoriaFinal,
        entradas: 0,
        salidas: 0,
      })
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo actualizar el producto.' });
  }
});

// Eliminar producto
router.delete('/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const restauranteId = await getDefaultRestaurantId();
    if (!restauranteId) {
      return res.status(404).json({ error: "El producto no existe." });
    }

    const currentResult = await pool.query(
      `SELECT p.id, p.nombre, s.nombre AS categoria, p.cantidad, p.unidad, p.stock_minimo, p.stock_maximo
       FROM products p
       JOIN sections s ON s.id = p.section_id
       WHERE p.id = $1 AND p.restaurante_id = $2`,
      [id, restauranteId]
    );

    const current = currentResult.rows[0];
    if (!current) {
      return res.status(404).json({ error: "El producto no existe." });
    }

    await pool.query('DELETE FROM products WHERE id = $1 AND restaurante_id = $2', [id, restauranteId]);

    return res.status(200).json({
      message: "Producto eliminado correctamente.",
      data: mapProduct({ ...current, entradas: 0, salidas: 0 })
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo eliminar el producto.' });
  }
});

module.exports = router;