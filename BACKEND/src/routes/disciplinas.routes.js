const express = require('express');
const router = express.Router();
const { escucharCambios } = require('../services/eventosDisciplinas');
const {
    obtenerDisciplinasActivas,
    obtenerCronogramaConsolidado,
    obtenerHistorialDeportista,
    buscarDisciplinas,
    administrarDisciplinas,
    probarLatenciaDisciplinas,
    reactivarDisciplina,
    crearDisciplina,
    actualizarDisciplina,
    darDeBajaDisciplina
} = require('../controllers/disciplinas.controller');
const {
    crearCronograma,
    darDeBajaCronograma
} = require('../controllers/cronogramas.controller');

const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

// Públicas
router.get('/eventos', escucharCambios);
router.get('/activas', obtenerDisciplinasActivas);
router.get('/cronograma', obtenerCronogramaConsolidado);
router.get('/', buscarDisciplinas);

// Deportista / Administrativo
router.get('/mi-historial', verificarToken, permitirRoles('DEPORTISTA'), obtenerHistorialDeportista);

// Solo Administrativo
router.get('/prueba-latencia', verificarToken, permitirRoles('ADMINISTRATIVO'), probarLatenciaDisciplinas);
router.get('/administracion', verificarToken, permitirRoles('ADMINISTRATIVO'), administrarDisciplinas);
router.patch('/:id/reactivar', verificarToken, permitirRoles('ADMINISTRATIVO'), reactivarDisciplina);
router.post('/', verificarToken, permitirRoles('ADMINISTRATIVO'), crearDisciplina);
router.put('/:id', verificarToken, permitirRoles('ADMINISTRATIVO'), actualizarDisciplina);
router.delete('/:id', verificarToken, permitirRoles('ADMINISTRATIVO'), darDeBajaDisciplina);
// Compatibilidad temporal: estos endpoints delegan al controlador oficial.
router.post('/cronograma', verificarToken, permitirRoles('ADMINISTRATIVO'), crearCronograma);
router.delete('/cronograma/:id', verificarToken, permitirRoles('ADMINISTRATIVO'), darDeBajaCronograma);

module.exports = router;