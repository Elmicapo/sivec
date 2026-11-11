import { Router } from 'express';
import { 
    obtenerAgendaEntrenador, 
    crearHorarioAgenda, 
    eliminarHorarioAgenda 
} from '../controllers/agenda.controller.js';
import { verifyToken, isEntrenador } from '../middlewares/auth.middleware.js'; // Ajusta a tus middlewares

const router = Router();

// Consultar la agenda del entrenador autenticado
router.get('/entrenador', [verifyToken, isEntrenador], obtenerAgendaEntrenador);

// Crear un nuevo horario en la agenda
router.post('/', [verifyToken, isEntrenador], crearHorarioAgenda);

// Eliminar un horario de la agenda por su ID
router.delete('/:id', [verifyToken, isEntrenador], eliminarHorarioAgenda);

export default router;