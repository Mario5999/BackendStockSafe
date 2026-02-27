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

// PUT: actualizar solo la cantidad de un producto
router.put('/products/:id/cantidad', (req, res) => {
  const { id } = req.params;
  const { cantidad } = req.body;

  if (cantidad === undefined) {
    return res.status(400).json({ error: "La cantidad es obligatoria." });
  }

  const index = productos.findIndex(prod => prod.id == id);

  if (index === -1) {
    return res.status(404).json({ error: "Producto no encontrado." });
  }

  // Actualizar solo la cantidad
  productos[index].cantidad = cantidad;

  return res.status(200).json({
    message: "Cantidad actualizada correctamente.",
    data: productos[index]
  });
});

module.exports = router;