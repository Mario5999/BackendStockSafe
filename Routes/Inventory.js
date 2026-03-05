const express = require('express');
const router = express.Router();
const store = require('../data/store');

// Base de datos simulada compartida
const productos = store.productos;

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

  const nuevaCantidad = Number(cantidad);
  if (Number.isNaN(nuevaCantidad) || nuevaCantidad < 0) {
    return res.status(400).json({ error: "La cantidad debe ser un número válido mayor o igual a 0." });
  }

  const index = productos.findIndex(prod => prod.id == id);

  if (index === -1) {
    return res.status(404).json({ error: "Producto no encontrado." });
  }

  const cantidadAnterior = Number(productos[index].cantidad) || 0;
  const diferencia = nuevaCantidad - cantidadAnterior;

  if (productos[index].stockInicial === undefined) {
    productos[index].stockInicial = cantidadAnterior;
  }
  if (productos[index].entradas === undefined) {
    productos[index].entradas = 0;
  }
  if (productos[index].salidas === undefined) {
    productos[index].salidas = 0;
  }

  if (diferencia > 0) {
    productos[index].entradas += diferencia;
  } else if (diferencia < 0) {
    productos[index].salidas += Math.abs(diferencia);
  }

  // Actualizar solo la cantidad
  productos[index].cantidad = nuevaCantidad;

  return res.status(200).json({
    message: "Cantidad actualizada correctamente.",
    data: productos[index]
  });
});

module.exports = router;