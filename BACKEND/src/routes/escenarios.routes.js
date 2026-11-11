const express = require('express');
const router = express.Router();
const { obtenerEscenarios } = require('../controllers/escenarios.controller');

const {
    crearReporteVeeduria,
    crearSolicitudEscenario,
    obtenerSolicitudesEscenarioPendientes,
    resolverSolicitudEscenario,
    obtenerReportesPendientes,
    obtenerReportesPendientesOficializacion,
    obtenerDetalleReporte,
    obtenerHistorialEscenario,
    obtenerSeguimiento,
    obtenerEvidencia,
    validarReporteVeeduria,
    oficializarReporteVeeduria
} = require('../controllers/veeduria.controller');

const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');

router.get('/', obtenerEscenarios);
router.post('/reportes', crearReporteVeeduria);
router.post('/solicitudes', crearSolicitudEscenario);
router.get('/solicitudes/pendientes', verificarToken, permitirRoles('CMJ'), obtenerSolicitudesEscenarioPendientes);
router.put('/solicitudes/:id_solicitud/resolver', verificarToken, permitirRoles('CMJ'), resolverSolicitudEscenario);
router.get('/reportes/seguimiento/:codigo', obtenerSeguimiento);
router.get('/reportes/escenario/:id_escenario/historico', obtenerHistorialEscenario);
router.get('/reportes/:id_reporte/evidencias/:orden', verificarToken, permitirRoles('CMJ'), obtenerEvidencia);
router.get('/reportes/pendientes', verificarToken, permitirRoles('CMJ', 'ADMINISTRATIVO'), obtenerReportesPendientes);
router.get('/reportes/validados-pendientes-oficializacion', verificarToken, permitirRoles('CMJ'), obtenerReportesPendientesOficializacion);
router.get('/reportes/:id_reporte', verificarToken, permitirRoles('CMJ'), obtenerDetalleReporte);
router.put('/reportes/:id_reporte/validar', verificarToken, permitirRoles('CMJ'), validarReporteVeeduria);
router.post('/reportes/:id_reporte/oficializar', verificarToken, permitirRoles('CMJ'), oficializarReporteVeeduria);

module.exports = router;