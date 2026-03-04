const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');

// GET: Generar PDF y descargarlo
router.get('/reportes/generar', (req, res) => {
  const doc = new PDFDocument();

  // Configurar headers para descarga
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=reporte_inventario.pdf');

  // Contenido del PDF
  doc.fontSize(20).text("Reporte de Inventario", { align: "center" });
  doc.moveDown();

  doc.fontSize(14).text("Producto: Tomate");
  doc.text("Categoría: Vegetales");
  doc.text("Cantidad en Sistema: 45 kg");
  doc.text("Fecha: " + new Date().toLocaleString());

  doc.moveDown();
  doc.text("Este reporte fue generado automáticamente desde el sistema.");

  // Enviar PDF al cliente
  doc.pipe(res);
  doc.end();
});

module.exports = router;