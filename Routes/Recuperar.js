const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Simulación de usuarios
let usuarios = [
  { id: 1, email: "usuario1@example.com", password: "123456", tokenRecuperacion: null, tokenExpira: null },
  { id: 2, email: "usuario2@example.com", password: "abcdef", tokenRecuperacion: null, tokenExpira: null }
];

// Configurar transporte de correo
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "TU_CORREO@gmail.com",
    pass: "TU_PASSWORD_DE_APLICACION"
  }
});

// 1️⃣ Solicitar recuperación (genera token y envía correo)
router.post('/recuperar/solicitar', (req, res) => {
  const { email } = req.body;

  const usuario = usuarios.find(u => u.email === email);

  if (!usuario) {
    return res.status(404).json({ error: "El correo no está registrado." });
  }

  // Generar token seguro
  const token = crypto.randomBytes(20).toString('hex');

  // Guardar token y expiración (15 minutos)
  usuario.tokenRecuperacion = token;
  usuario.tokenExpira = Date.now() + 15 * 60 * 1000;

  // Enlace al frontend
  const enlace = `http://localhost:3000/recuperar/${token}`;

  // Enviar correo
  const mailOptions = {
    from: "TU_CORREO@gmail.com",
    to: usuario.email,
    subject: "Recuperación de contraseña",
    html: `
      <h2>Recuperación de contraseña</h2>
      <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
      <a href="${enlace}">${enlace}</a>
      <p>Este enlace expirará en 15 minutos.</p>
    `
  };

  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      return res.status(500).json({ error: "Error al enviar el correo." });
    }

    return res.status(200).json({
      message: "Correo enviado. Revisa tu bandeja para continuar."
    });
  });
});

// 2️⃣ Validar token (cuando el usuario abre la vista del frontend)
router.get('/recuperar/validar/:token', (req, res) => {
  const { token } = req.params;

  const usuario = usuarios.find(
    u => u.tokenRecuperacion === token && u.tokenExpira > Date.now()
  );

  if (!usuario) {
    return res.status(400).json({ error: "Token inválido o expirado." });
  }

  return res.status(200).json({ message: "Token válido." });
});

// 3️⃣ Cambiar contraseña
router.post('/recuperar/cambiar', (req, res) => {
  const { token, nuevaPassword } = req.body;

  const usuario = usuarios.find(
    u => u.tokenRecuperacion === token && u.tokenExpira > Date.now()
  );

  if (!usuario) {
    return res.status(400).json({ error: "Token inválido o expirado." });
  }

  usuario.password = nuevaPassword;
  usuario.tokenRecuperacion = null;
  usuario.tokenExpira = null;

  return res.status(200).json({ message: "Contraseña actualizada correctamente." });
});

module.exports = router;