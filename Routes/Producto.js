const express = require('express');
const router = express.Router();

// Base de datos simulada
let productos = [];

// Crear producto
router.post('/products', (req, res) => {
  const { nombre, categoria, cantidad, unidad, stockMinimo } = req.body;

  // Validación
  if (!nombre || !categoria || !cantidad || !unidad || !stockMinimo) {
    return res.status(400).json({
      error: "Todos los campos son obligatorios: nombre, categoría, cantidad, unidad, stock mínimo."
    });
  }

  const nuevoProducto = {
    id: Date.now(),
    nombre,
    categoria,      // Aquí se guarda la sección seleccionada
    cantidad,
    unidad,
    stockMinimo
  };

  productos.push(nuevoProducto);

  return res.status(201).json({
    message: "Producto creado correctamente.",
    data: nuevoProducto
  });
});

// Obtener todos los productos
router.get('/products', (req, res) => {
  return res.status(200).json({
    message: "Lista de productos",
    data: productos
  });
});

// Editar producto
router.put('/products/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, categoria, cantidad, unidad, stockMinimo } = req.body;

  const index = productos.findIndex(prod => prod.id == id);

  if (index === -1) {
    return res.status(404).json({ error: "El producto no existe." });
  }

  if (nombre) productos[index].nombre = nombre;
  if (categoria) productos[index].categoria = categoria;
  if (cantidad) productos[index].cantidad = cantidad;
  if (unidad) productos[index].unidad = unidad;
  if (stockMinimo) productos[index].stockMinimo = stockMinimo;

  return res.status(200).json({
    message: "Producto actualizado correctamente.",
    data: productos[index]
  });
});

// Eliminar producto
router.delete('/products/:id', (req, res) => {
  const { id } = req.params;

  const index = productos.findIndex(prod => prod.id == id);

  if (index === -1) {
    return res.status(404).json({ error: "El producto no existe." });
  }

  const eliminado = productos.splice(index, 1);

  return res.status(200).json({
    message: "Producto eliminado correctamente.",
    data: eliminado[0]
  });
});

module.exports = router;