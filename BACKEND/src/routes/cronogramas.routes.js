const express = require('express');
const router = express.Router();
const {
    listarCronogramas,
    crearCronograma,
    actualizarCronograma,
    darDeBajaCronograma
} = require('../controllers/cronogramas.controller');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

const roles = permitirRoles('ADMINISTRATIVO', 'ENTRENADOR');

router.get('/', verificarToken, roles, listarCronogramas);
router.post('/', verificarToken, roles, crearCronograma);
router.put('/:id', verificarToken, roles, actualizarCronograma);
router.delete('/:id', verificarToken, roles, darDeBajaCronograma);

module.exports = router;