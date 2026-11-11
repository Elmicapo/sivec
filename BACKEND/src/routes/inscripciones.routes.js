// src/routes/inscripciones.routes.js
const express = require('express');
const router = express.Router();
const inscripcionesCtrl = require('../controllers/inscripciones.controller');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

// Rutas Protegidas Deportista
router.post('/', verificarToken, permitirRoles('DEPORTISTA'), inscripcionesCtrl.inscribirDeportista);

module.exports = router;