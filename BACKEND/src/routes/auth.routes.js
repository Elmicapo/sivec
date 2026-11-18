// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();

// IMPORTANTE: Se desestructura { login } para obtener la función del controlador
const { login, registrar } = require('../controllers/auth.controller');

const { solicitarRestablecimiento, restablecerPassword } = require('../controllers/restablecimiento.controller');

router.post('/login', login);
router.post('/registro', registrar);
router.post('/recuperar-contrasena', solicitarRestablecimiento);
router.post('/restablecer-contrasena', restablecerPassword);

module.exports = router;