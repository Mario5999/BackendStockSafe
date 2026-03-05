const express = require('express');
const router = express.Router();
const store = require('../data/store');

// Base de datos simulada compartida
const productos = store.productos;

// Crear producto
router.post('/products', (req, res) => {
  const { nombre, categoria, cantidad, unidad, stockMinimo, stockMaximo, stockExcedente } = req.body;
  const maximo = stockMaximo ?? stockExcedente;

  // Validación
  if (!nombre || !categoria || cantidad === undefined || !unidad || stockMinimo === undefined || maximo === undefined) {
    return res.status(400).json({
      error: "Todos los campos son obligatorios: nombre, categoría, cantidad, unidad, stock mínimo y stock máximo."
    });
  }

  if (maximo < stockMinimo) {
    return res.status(400).json({
      error: "El stock máximo debe ser mayor o igual al stock mínimo."
    });
  }

  const nuevoProducto = {
    id: Date.now(),
    nombre,
    categoria,      // Aquí se guarda la sección seleccionada
    cantidad,
    unidad,
    stockMinimo,
    stockMaximo: maximo,
    stockInicial: cantidad,
    entradas: 0,
    salidas: 0,
  };

  productos.push(nuevoProducto);

  return res.status(201).json({
    message: "Producto creado correctamente.",
    data: nuevoProducto
  });
});

// Obtener todos los productos
router.get('/products', (req, res) => {
  const productosConMovimientos = productos.map((producto) => ({
    ...producto,
    stockInicial: producto.stockInicial ?? producto.cantidad,
    entradas: producto.entradas ?? 0,
    salidas: producto.salidas ?? 0,
  }));

  return res.status(200).json({
    message: "Lista de productos",
    data: productosConMovimientos
  });
});

// Editar producto
router.put('/products/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, categoria, cantidad, unidad, stockMinimo, stockMaximo, stockExcedente } = req.body;

  const index = productos.findIndex(prod => prod.id == id);

  if (index === -1) {
    return res.status(404).json({ error: "El producto no existe." });
  }

  if (nombre) productos[index].nombre = nombre;
  if (categoria) productos[index].categoria = categoria;
  if (cantidad !== undefined) productos[index].cantidad = cantidad;
  if (unidad) productos[index].unidad = unidad;
  if (stockMinimo !== undefined) productos[index].stockMinimo = stockMinimo;

  const maximo = stockMaximo ?? stockExcedente;
  if (maximo !== undefined) productos[index].stockMaximo = maximo;

  if (productos[index].stockMaximo !== undefined && productos[index].stockMinimo !== undefined && productos[index].stockMaximo < productos[index].stockMinimo) {
    return res.status(400).json({ error: "El stock máximo debe ser mayor o igual al stock mínimo." });
  }

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