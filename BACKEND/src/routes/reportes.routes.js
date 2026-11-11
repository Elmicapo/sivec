const express = require('express');
const router = express.Router();
const {
    reporteEntrenadores,
    reporteDeportistasPorDisciplina,
    reporteDisciplinasDemanda,
    historicoVeedurias
} = require('../controllers/reportes.controller');

const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

// Rutas protegidas para roles Administrativos, Entrenadores y CMJ
router.get('/entrenadores', verificarToken, permitirRoles('ADMINISTRATIVO', 'ENTRENADOR'), reporteEntrenadores);
router.get('/deportistas-disciplina', verificarToken, permitirRoles('ADMINISTRATIVO', 'ENTRENADOR'), reporteDeportistasPorDisciplina);
router.get('/demanda-disciplinas', verificarToken, permitirRoles('ADMINISTRATIVO'), reporteDisciplinasDemanda);
router.get('/historico-veedurias', verificarToken, permitirRoles('ADMINISTRATIVO', 'CMJ'), historicoVeedurias);

module.exports = router;