const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { pool } = require('../db/pool');
const { getDefaultRestaurantId } = require('../db/context');

const REPORT_DUPLICATE_WINDOW_SECONDS = 20;

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatQuantity(value) {
  return toNumber(value).toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

async function resolveRestaurantId(queryRestaurantId) {
  const requestedRestaurantId = Number(queryRestaurantId);
  if (Number.isInteger(requestedRestaurantId) && requestedRestaurantId > 0) {
    return requestedRestaurantId;
  }

  return getDefaultRestaurantId();
}

function ensureSpace(doc, neededHeight) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottomLimit) {
    doc.addPage();
  }
}

function buildSnapshotSignature(products) {
  return JSON.stringify(
    [...products]
      .sort((a, b) => a.productoId - b.productoId)
      .map((product) => [
        toNumber(product.seccionId),
        toNumber(product.productoId),
        String(product.unidad || ''),
        toNumber(product.entradas),
        toNumber(product.salidas),
        toNumber(product.diferenciaVerificacion),
      ])
  );
}

function buildStoredSnapshotSignature(items) {
  return JSON.stringify(
    [...items]
      .sort((a, b) => toNumber(a.producto_id) - toNumber(b.producto_id))
      .map((item) => [
        toNumber(item.seccion_id),
        toNumber(item.producto_id),
        String(item.unidad || ''),
        toNumber(item.entradas),
        toNumber(item.salidas),
        toNumber(item.diferencia_verificacion),
      ])
  );
}

async function findReusableReport(client, restauranteId, currentSignature) {
  const latestResult = await client.query(
    `SELECT id, generated_at
     FROM report_generations
     WHERE restaurante_id = $1
     ORDER BY generated_at DESC, id DESC
     LIMIT 1`,
    [restauranteId]
  );

  const latest = latestResult.rows[0];
  if (!latest) {
    return null;
  }

  const secondsSinceLast = (Date.now() - new Date(latest.generated_at).getTime()) / 1000;
  if (secondsSinceLast > REPORT_DUPLICATE_WINDOW_SECONDS) {
    return null;
  }

  const itemsResult = await client.query(
    `SELECT
       seccion_id,
       producto_id,
       unidad,
       entradas,
       salidas,
       diferencia_verificacion
     FROM report_generation_items
     WHERE report_generation_id = $1`,
    [latest.id]
  );

  const latestSignature = buildStoredSnapshotSignature(itemsResult.rows);
  if (latestSignature !== currentSignature) {
    return null;
  }

  return {
    reportId: toNumber(latest.id),
    generatedAt: latest.generated_at,
  };
}

function renderInventoryPdf(res, options) {
  const {
    restauranteId,
    reportId,
    restaurantName,
    generatedAt,
    products,
  } = options;

  const groupedBySection = products.reduce((acc, product) => {
    if (!acc[product.seccion]) {
      acc[product.seccion] = [];
    }

    acc[product.seccion].push(product);
    return acc;
  }, {});

  const doc = new PDFDocument({ size: 'A4', margin: 44 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=reporte_inventario_restaurante_${restauranteId}_${reportId}.pdf`);
  doc.pipe(res);

  doc.fontSize(18).fillColor('#111827').text('Reporte de Inventario', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(11).fillColor('#374151').text(`Restaurante: ${restaurantName}`);
  doc.text(`Reporte ID: ${reportId}`);
  doc.text(`Fecha de generación: ${new Date(generatedAt).toLocaleString('es-ES')}`);
  doc.moveDown(0.8);

  if (products.length === 0) {
    doc.fontSize(12).fillColor('#6b7280').text('No hay productos registrados para este restaurante.');
    doc.end();
    return;
  }

  Object.entries(groupedBySection).forEach(([sectionName, sectionProducts]) => {
    ensureSpace(doc, 48);
    doc.fontSize(13).fillColor('#111827').text(`Sección: ${sectionName}`);
    doc.moveDown(0.2);

    sectionProducts.forEach((product) => {
      ensureSpace(doc, 24);
      doc.fontSize(10).fillColor('#1f2937').text(
        `${product.producto} (${product.unidad}) | Entradas: ${formatQuantity(product.entradas)} | Salidas: ${formatQuantity(product.salidas)} | Diferencia: ${formatQuantity(product.diferenciaVerificacion)}`
      );
    });

    const sectionEntradas = sectionProducts.reduce((sum, item) => sum + item.entradas, 0);
    const sectionSalidas = sectionProducts.reduce((sum, item) => sum + item.salidas, 0);
    const sectionDiferencia = sectionProducts.reduce((sum, item) => sum + item.diferenciaVerificacion, 0);

    ensureSpace(doc, 28);
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#374151').text(
      `Total sección | Entradas: ${formatQuantity(sectionEntradas)} | Salidas: ${formatQuantity(sectionSalidas)} | Diferencia: ${formatQuantity(sectionDiferencia)}`
    );
    doc.moveDown(0.8);
  });

  doc.end();
}

// GET: Generar PDF y descargarlo
router.get('/reportes/generar', async (req, res) => {
  try {
    const restauranteId = await resolveRestaurantId(req.query.restauranteId);
    if (!restauranteId) {
      return res.status(404).json({ error: 'No existe un restaurante válido para generar el reporte.' });
    }

    const restaurantResult = await pool.query(
      'SELECT id, restaurant_name FROM restaurantes WHERE id = $1 LIMIT 1',
      [restauranteId]
    );

    const restaurant = restaurantResult.rows[0];
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurante no encontrado.' });
    }

    const reportResult = await pool.query(
      `SELECT
         s.id AS seccion_id,
         p.id AS producto_id,
         s.nombre AS seccion,
         p.nombre AS producto,
         p.unidad,
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
       GROUP BY s.id, s.nombre, p.id, p.nombre, p.unidad, last_check.diferencia
       ORDER BY s.nombre ASC, p.nombre ASC`,
      [restauranteId]
    );

    const products = reportResult.rows.map((row) => ({
      seccionId: toNumber(row.seccion_id),
      productoId: toNumber(row.producto_id),
      seccion: row.seccion,
      producto: row.producto,
      unidad: row.unidad,
      entradas: toNumber(row.entradas),
      salidas: toNumber(row.salidas),
      diferenciaVerificacion: toNumber(row.diferencia_verificacion),
    }));

    const snapshotSignature = buildSnapshotSignature(products);
    const client = await pool.connect();
    let reportId;
    let generatedAt;

    try {
      await client.query('BEGIN');

      const reusableReport = await findReusableReport(client, restauranteId, snapshotSignature);
      if (reusableReport) {
        await client.query('COMMIT');

        return renderInventoryPdf(res, {
          restauranteId,
          reportId: reusableReport.reportId,
          restaurantName: restaurant.restaurant_name,
          generatedAt: reusableReport.generatedAt,
          products,
        });
      }

      const generationResult = await client.query(
        'INSERT INTO report_generations (restaurante_id) VALUES ($1) RETURNING id, generated_at',
        [restauranteId]
      );

      reportId = Number(generationResult.rows[0].id);
      generatedAt = generationResult.rows[0].generated_at;

      if (products.length > 0) {
        const values = [];
        const params = [];

        products.forEach((product, index) => {
          const offset = index * 11;
          values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`);
          params.push(
            reportId,
            restauranteId,
            product.seccionId,
            product.productoId,
            product.seccion,
            product.producto,
            product.unidad,
            product.entradas,
            product.salidas,
            product.diferenciaVerificacion,
            generatedAt
          );
        });

        await client.query(
          `INSERT INTO report_generation_items (
             report_generation_id,
             restaurante_id,
             seccion_id,
             producto_id,
             seccion_nombre,
             producto_nombre,
             unidad,
             entradas,
             salidas,
             diferencia_verificacion,
             generated_at
           ) VALUES ${values.join(', ')}`,
          params
        );
      }

      await client.query('COMMIT');
    } catch (insertError) {
      await client.query('ROLLBACK');
      throw insertError;
    } finally {
      client.release();
    }

    return renderInventoryPdf(res, {
      restauranteId,
      reportId,
      restaurantName: restaurant.restaurant_name,
      generatedAt,
      products,
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo generar el reporte PDF.' });
  }
});

// GET: visualizar un reporte histórico por su ID
router.get('/reportes/ver/:reportId', async (req, res) => {
  try {
    const reportId = Number(req.params.reportId);
    const restauranteId = Number(req.query.restauranteId);

    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({ error: 'reportId inválido.' });
    }

    if (!Number.isInteger(restauranteId) || restauranteId <= 0) {
      return res.status(400).json({ error: 'restauranteId inválido.' });
    }

    const reportHeaderResult = await pool.query(
      `SELECT
         g.id,
         g.restaurante_id,
         g.generated_at,
         r.restaurant_name
       FROM report_generations g
       JOIN restaurantes r ON r.id = g.restaurante_id
       WHERE g.id = $1 AND g.restaurante_id = $2
       LIMIT 1`,
      [reportId, restauranteId]
    );

    const reportHeader = reportHeaderResult.rows[0];
    if (!reportHeader) {
      return res.status(404).json({ error: 'Reporte no encontrado para este restaurante.' });
    }

    const itemsResult = await pool.query(
      `SELECT
         seccion_nombre AS seccion,
         producto_nombre AS producto,
         unidad,
         entradas,
         salidas,
         diferencia_verificacion
       FROM report_generation_items
       WHERE report_generation_id = $1 AND restaurante_id = $2
       ORDER BY seccion_nombre ASC, producto_nombre ASC`,
      [reportId, restauranteId]
    );

    const products = itemsResult.rows.map((row) => ({
      seccion: row.seccion,
      producto: row.producto,
      unidad: row.unidad,
      entradas: toNumber(row.entradas),
      salidas: toNumber(row.salidas),
      diferenciaVerificacion: toNumber(row.diferencia_verificacion),
    }));

    return renderInventoryPdf(res, {
      restauranteId: Number(reportHeader.restaurante_id),
      reportId: Number(reportHeader.id),
      restaurantName: reportHeader.restaurant_name,
      generatedAt: reportHeader.generated_at,
      products,
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo visualizar el reporte histórico.' });
  }
});

// GET: historial de reportes generados por restaurante
router.get('/reportes/historial', async (req, res) => {
  try {
    const restauranteId = Number(req.query.restauranteId);
    if (!Number.isInteger(restauranteId) || restauranteId <= 0) {
      return res.status(400).json({ error: 'restauranteId inválido.' });
    }

    const result = await pool.query(
      `WITH raw_reports AS (
         SELECT
           g.id,
           g.restaurante_id,
           g.generated_at,
           COUNT(i.id)::BIGINT AS total_items
         FROM report_generations g
         LEFT JOIN report_generation_items i ON i.report_generation_id = g.id
         WHERE g.restaurante_id = $1
         GROUP BY g.id, g.restaurante_id, g.generated_at
       ),
       ordered_reports AS (
         SELECT
           rr.*,
           LAG(rr.generated_at) OVER (ORDER BY rr.generated_at DESC, rr.id DESC) AS prev_generated_at,
           LAG(rr.total_items) OVER (ORDER BY rr.generated_at DESC, rr.id DESC) AS prev_total_items
         FROM raw_reports rr
       )
       SELECT
         id,
         restaurante_id,
         generated_at,
         total_items
       FROM ordered_reports
       WHERE NOT (
         prev_generated_at IS NOT NULL
         AND prev_total_items = total_items
         AND EXTRACT(EPOCH FROM (prev_generated_at - generated_at)) BETWEEN 0 AND $2
       )
       ORDER BY generated_at DESC, id DESC`,
      [restauranteId, REPORT_DUPLICATE_WINDOW_SECONDS]
    );

    return res.status(200).json({
      message: 'Historial de reportes',
      data: result.rows.map((row) => ({
        id: Number(row.id),
        restauranteId: Number(row.restaurante_id),
        generatedAt: row.generated_at,
        totalItems: Number(row.total_items),
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo obtener el historial de reportes.' });
  }
});

module.exports = router;