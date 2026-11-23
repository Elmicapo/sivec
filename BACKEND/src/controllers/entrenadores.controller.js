const db = require('../config/db');
const { configuracionCorreo, encolarCorreo } = require('../services/correo.service');
const { responderErrorInterno } = require('../utils/safeError');
const { assertSchemaObjectsAvailable, SchemaNotReadyError } = require('../utils/schemaAvailability');

const responderEsquemaNoDisponible = (res, error, message) => {
    if (!(error instanceof SchemaNotReadyError)) return false;
    res.status(503).json({ success: false, code: error.code, message });
    return true;
};

const SOLICITUD_TABLES = [
    'solicitud_vinculacion_entrenador',
    'disciplina',
    'persona'
];

const createVinculacionHandlers = (database = db) => {
    const listarMisSolicitudesVinculacion = async (req, res) => {
        try {
            await assertSchemaObjectsAvailable(database, SOLICITUD_TABLES);
            const [solicitudes] = await database.query(
                `SELECT s.id_solicitud_vinculacion, s.id_disciplina,
                        d.nombre AS disciplina, s.estado, s.fecha_solicitud,
                        s.fecha_resolucion, s.id_administrativo_resuelve,
                        pa.nombre_completo AS administrador_resuelve
                 FROM solicitud_vinculacion_entrenador s
                 JOIN disciplina d ON d.id_disciplina = s.id_disciplina
                 LEFT JOIN persona pa ON pa.id_persona = s.id_administrativo_resuelve
                 WHERE s.id_entrenador = ?
                 ORDER BY s.fecha_solicitud DESC, s.id_solicitud_vinculacion DESC`,
                [req.usuario.id_persona]
            );
            return res.json({ success: true, data: solicitudes });
        } catch (error) {
            if (responderEsquemaNoDisponible(res, error, 'El flujo de aprobación de entrenadores aún no está habilitado')) return;
            if (error.code === 'ER_NO_SUCH_TABLE') {
                return res.status(503).json({
                    success: false,
                    message: 'El flujo de aprobación de entrenadores aún no está habilitado'
                });
            }
            console.error('Error al listar solicitudes del entrenador:', error.code || 'UNKNOWN_ERROR');
            return res.status(500).json({ success: false, message: 'Error al consultar tus solicitudes' });
        }
    };

    const solicitarVinculacion = async (req, res) => {
        const idEntrenador = Number(req.usuario.id_persona);
        const idDisciplina = Number(req.body?.id_disciplina);
        if (!Number.isSafeInteger(idEntrenador) || idEntrenador <= 0
            || !Number.isSafeInteger(idDisciplina) || idDisciplina <= 0) {
            return res.status(400).json({ success: false, message: 'La disciplina seleccionada no es válida' });
        }

        const connection = await database.getConnection();
        try {
            await assertSchemaObjectsAvailable(connection, [
                'entrenador',
                'disciplina',
                'disciplina_entrenador',
                'solicitud_vinculacion_entrenador'
            ]);
            await connection.beginTransaction();
            const [entrenadores] = await connection.query(
                'SELECT id_persona FROM entrenador WHERE id_persona = ? AND activo FOR UPDATE',
                [idEntrenador]
            );
            if (!entrenadores.length) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'El usuario no tiene un perfil de entrenador activo'
                });
            }

            const [disciplinas] = await connection.query(
                `SELECT id_disciplina FROM disciplina
                 WHERE id_disciplina = ? AND estado = 'ACTIVA'`,
                [idDisciplina]
            );
            if (!disciplinas.length) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'La disciplina no existe o está inactiva'
                });
            }

            const [vinculaciones] = await connection.query(
                `SELECT 1 FROM disciplina_entrenador
                 WHERE id_disciplina = ? AND id_entrenador = ?`,
                [idDisciplina, idEntrenador]
            );
            if (vinculaciones.length) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe una vinculación aprobada con esta disciplina'
                });
            }

            const [pendientes] = await connection.query(
                `SELECT 1 FROM solicitud_vinculacion_entrenador
                 WHERE id_disciplina = ? AND id_entrenador = ? AND estado = 'PENDIENTE'
                 FOR UPDATE`,
                [idDisciplina, idEntrenador]
            );
            if (pendientes.length) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe una solicitud pendiente para esta disciplina'
                });
            }

            const [resultado] = await connection.query(
                `INSERT INTO solicitud_vinculacion_entrenador
                    (id_entrenador, id_disciplina, estado)
                 VALUES (?, ?, 'PENDIENTE')`,
                [idEntrenador, idDisciplina]
            );
            await connection.commit();
            return res.status(201).json({
                success: true,
                message: 'Solicitud de vinculación enviada',
                id_solicitud_vinculacion: resultado.insertId
            });
        } catch (error) {
            await connection.rollback();
            if (responderEsquemaNoDisponible(res, error, 'El flujo de aprobación de entrenadores aún no está habilitado')) return;
            if (error.code === 'ER_NO_SUCH_TABLE') {
                return res.status(503).json({
                    success: false,
                    message: 'El flujo de aprobación de entrenadores aún no está habilitado'
                });
            }
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    message: 'La solicitud o vinculación ya existe'
                });
            }
            console.error('Error al crear solicitud de vinculación:', error.code || 'UNKNOWN_ERROR');
            return res.status(500).json({ success: false, message: 'Error al crear la solicitud' });
        } finally {
            connection.release();
        }
    };

    const listarSolicitudesVinculacion = async (req, res) => {
        try {
            await assertSchemaObjectsAvailable(database, SOLICITUD_TABLES);
            const [solicitudes] = await database.query(
                `SELECT s.id_solicitud_vinculacion, s.id_entrenador, s.id_disciplina,
                        s.fecha_solicitud, p.nombre_completo, p.correo_electronico,
                        p.telefono, d.nombre AS disciplina
                 FROM solicitud_vinculacion_entrenador s
                 JOIN persona p ON p.id_persona = s.id_entrenador
                 JOIN disciplina d ON d.id_disciplina = s.id_disciplina
                 WHERE s.estado = 'PENDIENTE'
                 ORDER BY s.fecha_solicitud, s.id_solicitud_vinculacion`
            );
            return res.json({ success: true, data: solicitudes });
        } catch (error) {
            if (responderEsquemaNoDisponible(res, error, 'El flujo de aprobación de entrenadores aún no está habilitado')) return;
            if (error.code === 'ER_NO_SUCH_TABLE') {
                return res.status(503).json({
                    success: false,
                    message: 'El flujo de aprobación de entrenadores aún no está habilitado'
                });
            }
            console.error('Error al listar solicitudes de vinculación:', error);
            return res.status(500).json({ success: false, message: 'Error al consultar solicitudes de vinculación' });
        }
    };

    const resolverSolicitudVinculacion = async (req, res) => {
        const idSolicitud = Number(req.params.id);
        const estado = req.body?.estado;
        if (!Number.isSafeInteger(idSolicitud) || idSolicitud <= 0
            || !['APROBADA', 'RECHAZADA'].includes(estado)) {
            return res.status(400).json({ success: false, message: 'Solicitud o decisión inválida' });
        }

        const connection = await database.getConnection();
        try {
            await assertSchemaObjectsAvailable(connection, [
                'solicitud_vinculacion_entrenador',
                'disciplina_entrenador'
            ]);
            await connection.beginTransaction();
            const [solicitudes] = await connection.query(
                `SELECT id_entrenador, id_disciplina, estado
                 FROM solicitud_vinculacion_entrenador
                 WHERE id_solicitud_vinculacion = ?
                 FOR UPDATE`,
                [idSolicitud]
            );
            if (!solicitudes.length) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
            }
            const solicitud = solicitudes[0];
            if (solicitud.estado !== 'PENDIENTE') {
                await connection.rollback();
                return res.status(409).json({ success: false, message: 'La solicitud ya fue resuelta' });
            }

            if (estado === 'APROBADA') {
                await connection.query(
                    'INSERT INTO disciplina_entrenador (id_disciplina, id_entrenador) VALUES (?, ?)',
                    [solicitud.id_disciplina, solicitud.id_entrenador]
                );
            }
            await connection.query(
                `UPDATE solicitud_vinculacion_entrenador
                 SET estado = ?, id_administrativo_resuelve = ?, fecha_resolucion = NOW()
                 WHERE id_solicitud_vinculacion = ? AND estado = 'PENDIENTE'`,
                [estado, req.usuario.id_persona, idSolicitud]
            );
            if (configuracionCorreo()) {
                const [[contacto]] = await connection.query(
                    'SELECT correo_electronico FROM persona WHERE id_persona = ?', [solicitud.id_entrenador]
                );
                await encolarCorreo(connection, {
                    para: contacto?.correo_electronico,
                    asunto: 'Tu solicitud de vinculación en SIVEC',
                    texto: `La solicitud #${idSolicitud} fue ${estado.toLowerCase()}. Revisa el detalle en Mis solicitudes de SIVEC.`
                });
            }
            await connection.commit();
            return res.json({
                success: true,
                message: estado === 'APROBADA'
                    ? 'Vinculación aprobada'
                    : 'Solicitud rechazada'
            });
        } catch (error) {
            await connection.rollback();
            if (responderEsquemaNoDisponible(res, error, 'El flujo de aprobación de entrenadores aún no está habilitado')) return;
            if (error.code === 'ER_NO_SUCH_TABLE') {
                return res.status(503).json({
                    success: false,
                    message: 'El flujo de aprobación de entrenadores aún no está habilitado'
                });
            }
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: 'La vinculación ya existe' });
            }
            console.error('Error al resolver solicitud de vinculación:', error);
            return res.status(500).json({ success: false, message: 'Error al resolver la solicitud' });
        } finally {
            connection.release();
        }
    };

    return {
        listarMisSolicitudesVinculacion,
        listarSolicitudesVinculacion,
        resolverSolicitudVinculacion,
        solicitarVinculacion
    };
};

const {
    listarMisSolicitudesVinculacion,
    listarSolicitudesVinculacion,
    resolverSolicitudVinculacion,
    solicitarVinculacion
} = createVinculacionHandlers();

// Buscar entrenadores por nombre o deporte (ADMINISTRATIVO, DEPORTISTA)
const buscarEntrenadores = async (req, res) => {
    const { nombre, deporte } = req.query;
    let sql = 'SELECT * FROM v_rep_entrenadores WHERE 1=1';
    const params = [];
    if (nombre)  { sql += ' AND nombre_completo LIKE ?'; params.push(`%${nombre}%`); }
    if (deporte) { sql += ' AND deportes LIKE ?';        params.push(`%${deporte}%`); }
    sql += ' ORDER BY nombre_completo';

    try {
        await assertSchemaObjectsAvailable(db, [{ name: 'v_rep_entrenadores', type: 'VIEW' }]);
        const [data] = await db.query(sql, params);
        res.json({ success: true, data });
    } catch (error) {
        if (responderEsquemaNoDisponible(res, error, 'El catálogo de entrenadores aún no está habilitado.')) return;
        return responderErrorInterno(res, 'entrenadores.buscar', 'Error al buscar entrenadores')(error);
    }
};

// Buscar deportistas por nombre o por disciplina (ENTRENADOR, ADMINISTRATIVO)
const buscarDeportistas = async (req, res) => {
    const { nombre, deporte } = req.query;
    let sql = `SELECT p.id_persona, p.nombre_completo,
                      GROUP_CONCAT(DISTINCT d.nombre ORDER BY d.nombre SEPARATOR ', ') AS disciplinas
                 FROM deportista dep
                 JOIN persona p ON p.id_persona = dep.id_persona
                 LEFT JOIN inscripcion i ON i.id_deportista = dep.id_persona AND i.estado = 'ACTIVA'
                 LEFT JOIN disciplina d ON d.id_disciplina = i.id_disciplina
                WHERE dep.activo`;
    const params = [];
    if (nombre) { sql += ' AND p.nombre_completo LIKE ?'; params.push(`%${nombre}%`); }
    sql += ' GROUP BY p.id_persona, p.nombre_completo';
    if (deporte) { sql += ' HAVING disciplinas LIKE ?'; params.push(`%${deporte}%`); }
    sql += ' ORDER BY p.nombre_completo';

    try {
        await assertSchemaObjectsAvailable(db, ['deportista', 'persona', 'inscripcion', 'disciplina']);
        const [data] = await db.query(sql, params);
        res.json({ success: true, data });
    } catch (error) {
        if (responderEsquemaNoDisponible(res, error, 'La consulta de deportistas aún no está habilitada.')) return;
        return responderErrorInterno(res, 'entrenadores.deportistas', 'Error al buscar deportistas')(error);
    }
};

// Deportistas inscritos en las disciplinas del entrenador que inició sesión
const misDeportistas = async (req, res) => {
    try {
        await assertSchemaObjectsAvailable(db, [
            'disciplina_entrenador',
            'disciplina',
            'inscripcion',
            'persona'
        ]);
        const [data] = await db.query(
            `SELECT d.id_disciplina, d.nombre AS disciplina, i.id_deportista, p.nombre_completo AS deportista, i.fecha_inscripcion
               FROM disciplina_entrenador de
               JOIN disciplina d ON d.id_disciplina = de.id_disciplina
               JOIN inscripcion i ON i.id_disciplina = d.id_disciplina AND i.estado = 'ACTIVA'
               JOIN persona p ON p.id_persona = i.id_deportista
              WHERE de.id_entrenador = ?
              ORDER BY d.nombre, p.nombre_completo`,
            [req.usuario.id_persona]
        );
        res.json({ success: true, data });
    } catch (error) {
        if (responderEsquemaNoDisponible(res, error, 'La consulta de tus deportistas aún no está habilitada.')) return;
        return responderErrorInterno(res, 'entrenadores.mis_deportistas', 'Error al consultar tus deportistas')(error);
    }
};

const listarDisciplinasParaAgenda = async (req, res) => {
    try {
        await assertSchemaObjectsAvailable(db, ['disciplina', 'disciplina_entrenador', 'solicitud_vinculacion_entrenador']);
        const idEntrenador = req.usuario.id_persona;
        const [data] = await db.query(
            `SELECT d.id_disciplina, d.nombre,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM disciplina_entrenador de
                         WHERE de.id_disciplina = d.id_disciplina AND de.id_entrenador = ?
                    ) THEN 'VINCULADA'
                    WHEN EXISTS (
                        SELECT 1 FROM solicitud_vinculacion_entrenador s
                         WHERE s.id_disciplina = d.id_disciplina AND s.id_entrenador = ? AND s.estado = 'PENDIENTE'
                    ) THEN 'PENDIENTE'
                    ELSE 'DISPONIBLE' END AS vinculacion
               FROM disciplina d
              WHERE d.estado = 'ACTIVA'
              ORDER BY d.nombre`,
            [idEntrenador, idEntrenador]
        );
        res.json({ success: true, data });
    } catch (error) {
        if (responderEsquemaNoDisponible(res, error, 'El catálogo de vinculación aún no está habilitado.')) return;
        return responderErrorInterno(res, 'entrenadores.disciplinas_agenda', 'No se pudieron consultar las disciplinas de tu agenda.')(error);
    }
};

module.exports = {
    buscarEntrenadores,
    buscarDeportistas,
    createVinculacionHandlers,
    listarDisciplinasParaAgenda,
    listarMisSolicitudesVinculacion,
    listarSolicitudesVinculacion,
    misDeportistas,
    resolverSolicitudVinculacion,
    solicitarVinculacion
};