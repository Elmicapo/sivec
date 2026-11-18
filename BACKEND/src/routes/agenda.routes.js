const { Router } = require('express');
const {
    obtenerAgendaEntrenador,
    crearHorarioAgenda,
    eliminarHorarioAgenda
} = require('../controllers/agenda.controller');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

const router = Router();
const isEntrenador = permitirRoles('ENTRENADOR');

// Consultar la agenda del entrenador autenticado
router.get('/entrenador', verificarToken, isEntrenador, obtenerAgendaEntrenador);

// Crear un nuevo horario en la agenda
router.post('/', verificarToken, isEntrenador, crearHorarioAgenda);

// Eliminar un horario de la agenda por su ID
router.delete('/:id', verificarToken, isEntrenador, eliminarHorarioAgenda);

module.exports = router;
