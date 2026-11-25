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
            `WITH digito AS (
                SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
            ), serie AS (
                SELECT 1 + u.n + 10*d.n + 100*c.n + 1000*m.n AS n
                  FROM digito u CROSS JOIN digito d CROSS JOIN digito c CROSS JOIN digito m
            )
            SELECT n AS id_usuario,
                   CONCAT('Usuario de prueba ', LPAD(n, 5, '0')) AS nombre_completo,
                   CONCAT('usuario-', LPAD(n, 5, '0'), '@example.test') AS correo_electronico,
                   CASE MOD(n, 20)
                     WHEN 0 THEN 'ADMINISTRATIVO' WHEN 1 THEN 'CMJ'
                     WHEN 2 THEN 'ENTRENADOR' WHEN 3 THEN 'ENTRENADOR' ELSE 'DEPORTISTA'
                   END AS rol,
                   MOD(n, 10) <> 0 AS activo
              FROM serie
             ORDER BY n`
        );
        if (data.length !== 10000) {
            return res.status(409).json({ success: false, message: `La prueba encontró ${data.length} de los 10.000 usuarios esperados.` });
        }
        return res.json({ success: true, data });
    } catch (error) {
        return responderErrorInterno(res, 'pruebas.latencia_usuarios', 'No se pudo generar la muestra de usuarios.')(error);
    }
});

module.exports = router;
