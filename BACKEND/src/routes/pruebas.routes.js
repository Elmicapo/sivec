const router = require('express').Router();
const db = require('../config/db');
const { verificarToken, permitirRoles } = require('../middlewares/authMiddleware');
const { responderErrorInterno } = require('../utils/safeError');

router.get('/latencia/usuarios', verificarToken, permitirRoles('ADMINISTRATIVO'), async (_req, res) => {
    if (process.env.SIVEC_PRUEBA_LATENCIA !== '1') {
        return res.status(404).json({ success: false, message: 'La prueba de latencia está deshabilitada.' });
    }

    try {
        const [data] = await db.query(
            `SELECT id_usuario, nombre_completo, correo_electronico, rol, activo
               FROM sivec_latencia.usuario_sintetico
              ORDER BY id_usuario
              LIMIT 10000`
        );
        if (data.length !== 10000) {
            return res.status(409).json({ success: false, message: `La prueba encontró ${data.length} de los 10.000 usuarios esperados.` });
        }
        return res.json({ success: true, data });
    } catch (error) {
        if (['ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE', 'ER_TABLEACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR'].includes(error.code)) {
            return res.status(503).json({ success: false, message: 'Carga el SQL de usuarios sintéticos en sivec_latencia y verifica el permiso de lectura.' });
        }
        return responderErrorInterno(res, 'pruebas.latencia_usuarios', 'No se pudo consultar la muestra de usuarios.')(error);
    }
});

module.exports = router;
