const express = require('express');
const router = express.Router();

// Base de datos simulada
let restaurantes = [];

// POST: registrar restaurante
router.post('/register', (req, res) => {
  const {
    restaurantName,
    address,
    phone,
    email,
    password,
    confirmPassword,
    managerName,
    managerEmail
  } = req.body;

  if (
    !restaurantName ||
    !address ||
    !phone ||
    !email ||
    !password ||
    !confirmPassword ||
    !managerName ||
    !managerEmail
  ) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
  }

  const newRestaurant = {
    id: Date.now(),
    restaurantName,
    address,
    phone,
    email,
    managerName,
    managerEmail
  };

  restaurantes.push(newRestaurant);

  return res.status(201).json({
    message: 'Restaurante registrado correctamente.',
    data: newRestaurant
  });
});

// GET: obtener todos los restaurantes
router.get('/register', (req, res) => {
  return res.status(200).json({
    message: "Lista de restaurantes registrados",
    data: restaurantes
  });
});

// PUT: editar restaurante
router.put('/register/:id', (req, res) => {
  const { id } = req.params;
  const {
    restaurantName,
    address,
    phone,
    email,
    managerName,
    managerEmail
  } = req.body;

  const index = restaurantes.findIndex(rest => rest.id == id);

  if (index === -1) {
    return res.status(404).json({ error: 'El restaurante no existe.' });
  }

  if (restaurantName) restaurantes[index].restaurantName = restaurantName;
  if (address) restaurantes[index].address = address;
  if (phone) restaurantes[index].phone = phone;
  if (email) restaurantes[index].email = email;
  if (managerName) restaurantes[index].managerName = managerName;
  if (managerEmail) restaurantes[index].managerEmail = managerEmail;

  return res.status(200).json({
    message: 'Restaurante actualizado correctamente.',
    data: restaurantes[index]
  });
});

// DELETE: eliminar restaurante
router.delete('/register/:id', (req, res) => {
  const { id } = req.params;

  const index = restaurantes.findIndex(rest => rest.id == id);

  if (index === -1) {
    return res.status(404).json({ error: 'El restaurante no existe.' });
  }

  const eliminado = restaurantes.splice(index, 1);

  return res.status(200).json({
    message: 'Restaurante eliminado correctamente.',
    data: eliminado[0]
  });
});

module.exports = router;