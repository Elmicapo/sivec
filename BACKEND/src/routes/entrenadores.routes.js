const express = require('express');
const router = express.Router();
const {
    buscarEntrenadores,
    buscarDeportistas,
    listarMisSolicitudesVinculacion,
    listarSolicitudesVinculacion,
    misDeportistas,
    resolverSolicitudVinculacion,
    solicitarVinculacion
} = require('../controllers/entrenadores.controller');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, permitirRoles('ADMINISTRATIVO', 'DEPORTISTA'), buscarEntrenadores);
router.get('/deportistas', verificarToken, permitirRoles('ENTRENADOR', 'ADMINISTRATIVO'), buscarDeportistas);
router.get('/mis-deportistas', verificarToken, permitirRoles('ENTRENADOR'), misDeportistas);
router.get('/mis-solicitudes', verificarToken, permitirRoles('ENTRENADOR'), listarMisSolicitudesVinculacion);
router.post('/solicitudes-vinculacion', verificarToken, permitirRoles('ENTRENADOR'), solicitarVinculacion);
router.get('/solicitudes-vinculacion', verificarToken, permitirRoles('ADMINISTRATIVO'), listarSolicitudesVinculacion);
router.post('/solicitudes-vinculacion/:id/resolver', verificarToken, permitirRoles('ADMINISTRATIVO'), resolverSolicitudVinculacion);

module.exports = router;