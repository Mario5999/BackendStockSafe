const express = require('express');
const router = express.Router();

// Base de datos simulada
let productos = [];

// Verificar inventario
router.post('/inventory/check', (req, res) => {
  const { productId, cantidadFisica } = req.body;

  const producto = productos.find(p => p.id == productId);

  if (!producto) {
    return res.status(404).json({ error: "Producto no encontrado." });
  }

  const diferencia = producto.cantidad - cantidadFisica;

  if (diferencia === 0) {
    return res.status(200).json({
      status: "ok",
      message: "Inventario correcto",
      sistema: producto.cantidad,
      fisico: cantidadFisica,
      diferencia: 0
    });
  } else {
    return res.status(200).json({
      status: "error",
      message: "Diferencia detectada",
      sistema: producto.cantidad,
      fisico: cantidadFisica,
      diferencia
    });
  }
});

module.exports = router;