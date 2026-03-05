const express = require('express');
const router = express.Router();
const store = require('../data/store');

// Base de datos simulada compartida
const secciones = store.secciones;

// Crear sección
router.post('/sections', (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: "El nombre de la sección es obligatorio." });
  }

  const nuevaSeccion = {
    id: Date.now(),
    nombre,
  };

  secciones.push(nuevaSeccion);

  return res.status(201).json({
    message: "Sección creada correctamente.",
    data: nuevaSeccion
  });
});

// Obtener todas las secciones
router.get('/sections', (req, res) => {
  return res.status(200).json({
    message: "Lista de secciones",
    data: secciones
  });
});

// Editar sección por ID
router.put('/sections/:id', (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;

  const index = secciones.findIndex(sec => sec.id == id);

  if (index === -1) {
    return res.status(404).json({ error: "La sección no existe." });
  }

  // Actualizar valores
  if (nombre) secciones[index].nombre = nombre;

  return res.status(200).json({
    message: "Sección actualizada correctamente.",
    data: secciones[index]
  });
});

// Eliminar sección
router.delete('/sections/:id', (req, res) => {
  const { id } = req.params;

  const index = secciones.findIndex(sec => sec.id == id);

  if (index === -1) {
    return res.status(404).json({ error: "La sección no existe." });
  }

  const eliminada = secciones.splice(index, 1);

  return res.status(200).json({
    message: "Sección eliminada correctamente.",
    data: eliminada[0]
  });
});

module.exports = router;