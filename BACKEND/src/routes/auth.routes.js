// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();

// IMPORTANTE: Se desestructura { login } para obtener la función del controlador
const { login, registrar } = require('../controllers/auth.controller');

router.post('/login', login);
router.post('/registro', registrar);

module.exports = router;