const db = require('../config/db');
const { responderErrorInterno } = require('../utils/safeError');
const { assertSchemaObjectsAvailable } = require('../utils/schemaAvailability');

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
const SCHEMA_ERROR = {
    code: 'SCHEMA_NOT_READY',
    message: 'El módulo de cronogramas aún no está habilitado.'
};
const CRONOGRAMA_TABLES = [
    'cronograma',
    'disciplina',
    'escenario',
    'entrenador',
    'disciplina_entrenador',
    'disciplina_escenario'
];

const assertCronogramaTables = (connection) => assertSchemaObjectsAvailable(
    connection,
    CRONOGRAMA_TABLES,
    SCHEMA_ERROR
);
const assertCronogramaView = (connection) => assertSchemaObjectsAvailable(
    connection,
    [{ name: 'v_cronograma_consolidado', type: 'VIEW' }],
    SCHEMA_ERROR
);

// Toma los datos del body; si es ENTRENADOR, siempre se programa a sí mismo
const normalizar = (req) => {
    const b = req.body;
    return {
        id_disciplina: Number(b.id_disciplina),
        id_escenario: Number(b.id_escenario),
        id_entrenador: req.usuario.rol === 'ENTRENADOR' ? req.usuario.id_persona : Number(b.id_entrenador),
        dia_semana: b.dia_semana,
        hora_inicio: String(b.hora_inicio || '').slice(0, 5),
        hora_fin: String(b.hora_fin || '').slice(0, 5),
        vigencia_desde: b.vigencia_desde,
        vigencia_hasta: b.vigencia_hasta || null
    };
};

const validar = (c) => {
    if (!c.id_disciplina || !c.id_escenario || !c.id_entrenador) return 'Disciplina, escenario y entrenador son obligatorios';
    if (!DIAS.includes(c.dia_semana)) return 'Día de la semana inválido';
    if (!c.hora_inicio || !c.hora_fin || c.hora_fin <= c.hora_inicio) return 'La hora de fin debe ser posterior a la hora de inicio';
    if (!c.vigencia_desde) return 'La fecha de inicio de vigencia es obligatoria';
    if (c.vigencia_hasta && c.vigencia_hasta < c.vigencia_desde) return 'La vigencia final no puede ser anterior a la inicial';
    return null;
};

// Comprueba referencias activas y relaciones previamente aprobadas.
const validarReferencias = async (conn, c, usuario) => {
    const [[d]] = await conn.query("SELECT 1 AS ok FROM disciplina WHERE id_disciplina = ? AND estado = 'ACTIVA' FOR SHARE", [c.id_disciplina]);
    if (!d) return 'La disciplina no existe o está inactiva';
    const [[e]] = await conn.query('SELECT 1 AS ok FROM escenario WHERE id_escenario = ? AND activo', [c.id_escenario]);
    if (!e) return 'El escenario no existe o está inactivo';
    const [[t]] = await conn.query('SELECT 1 AS ok FROM entrenador WHERE id_persona = ? AND activo', [c.id_entrenador]);
    if (!t) return 'El entrenador no existe o está inactivo';
    const [[vinculado]] = await conn.query(
        `SELECT 1 AS ok FROM disciplina_entrenador
         WHERE id_disciplina = ? AND id_entrenador = ?`,
        [c.id_disciplina, c.id_entrenador]
    );
    if (!vinculado) return 'La vinculación del entrenador con esta disciplina debe ser aprobada por un administrador antes de crear el cronograma';

    const [[asignado]] = await conn.query(
        `SELECT 1 AS ok FROM disciplina_escenario
         WHERE id_disciplina = ? AND id_escenario = ?`,
        [c.id_disciplina, c.id_escenario]
    );
    if (!asignado) return 'La disciplina no está habilitada para el escenario seleccionado';
    return null;
};

// Un entrenador no puede estar en dos clases a la vez y un escenario no puede tener dos a la vez
const hayConflicto = async (conn, c, idExcluir) => {
    const [filas] = await conn.query(
        `SELECT id_entrenador, id_escenario FROM cronograma
         WHERE activo AND dia_semana = ?
           AND hora_inicio < ? AND ? < hora_fin
           AND vigencia_desde <= COALESCE(?, '9999-12-31')
           AND ? <= COALESCE(vigencia_hasta, '9999-12-31')
           AND (id_entrenador = ? OR id_escenario = ?)
           AND id_cronograma <> ?`,
        [c.dia_semana, c.hora_fin, c.hora_inicio, c.vigencia_hasta, c.vigencia_desde,
         c.id_entrenador, c.id_escenario, idExcluir]
    );
    if (filas.length === 0) return null;
    return filas.some((f) => f.id_entrenador === c.id_entrenador)
        ? 'El entrenador ya tiene una clase en ese horario'
        : 'El escenario ya está ocupado en ese horario';
};

// Listar (ADMINISTRATIVO ve todos; ENTRENADOR solo los suyos)
const listarCronogramas = async (req, res) => {
    const { id_entrenador, id_escenario, id_disciplina } = req.query;
    let sql = 'SELECT * FROM v_cronograma_consolidado WHERE 1=1';
    const params = [];

    if (req.usuario.rol === 'ENTRENADOR') {
        sql += ' AND id_entrenador = ?'; params.push(req.usuario.id_persona);
    } else if (id_entrenador) {
        sql += ' AND id_entrenador = ?'; params.push(id_entrenador);
    }
    if (id_escenario)  { sql += ' AND id_escenario = ?';  params.push(id_escenario); }
    if (id_disciplina) { sql += ' AND id_disciplina = ?'; params.push(id_disciplina); }

    try {
        await assertCronogramaView(db);
        const [data] = await db.query(sql, params);
        res.json({ success: true, data });
    } catch (error) {
        if (error.code === SCHEMA_ERROR.code && error.statusCode === 503) {
            return res.status(503).json({ success: false, code: error.code, message: error.message });
        }
        return responderErrorInterno(res, 'cronogramas.listar', 'Error al consultar cronogramas')(error);
    }
};

const crearCronograma = async (req, res) => {
    const c = normalizar(req);
    const errorDatos = validar(c);
    if (errorDatos) return res.status(400).json({ success: false, message: errorDatos });

    const conn = await db.getConnection();
    let transactionStarted = false;
    try {
        await assertCronogramaTables(conn);
        await conn.beginTransaction();
        transactionStarted = true;
        const problema = (await validarReferencias(conn, c, req.usuario)) || (await hayConflicto(conn, c, 0));
        if (problema) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: problema });
        }
        const [r] = await conn.query(
            `INSERT INTO cronograma (id_disciplina, id_escenario, id_entrenador, dia_semana,
                                     hora_inicio, hora_fin, vigencia_desde, vigencia_hasta)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id_disciplina, c.id_escenario, c.id_entrenador, c.dia_semana,
             c.hora_inicio, c.hora_fin, c.vigencia_desde, c.vigencia_hasta]
        );
        await conn.commit();
        res.status(201).json({ success: true, message: 'Cronograma registrado', id_cronograma: r.insertId });
    } catch (error) {
        if (transactionStarted) await conn.rollback();
        if (error.code === SCHEMA_ERROR.code && error.statusCode === 503) {
            return res.status(503).json({ success: false, code: error.code, message: error.message });
        }
        return responderErrorInterno(res, 'cronogramas.crear', 'Error al registrar el cronograma')(error);
    } finally {
        conn.release();
    }
};

const actualizarCronograma = async (req, res) => {
    const { id } = req.params;
    const c = normalizar(req);
    const errorDatos = validar(c);
    if (errorDatos) return res.status(400).json({ success: false, message: errorDatos });

    const conn = await db.getConnection();
    let transactionStarted = false;
    try {
        await assertCronogramaTables(conn);
        const [[actual]] = await conn.query('SELECT id_entrenador FROM cronograma WHERE id_cronograma = ? AND activo', [id]);
        if (!actual) return res.status(404).json({ success: false, message: 'Cronograma no encontrado' });
        if (req.usuario.rol === 'ENTRENADOR' && actual.id_entrenador !== req.usuario.id_persona) {
            return res.status(403).json({ success: false, message: 'Solo puedes modificar tus propios horarios' });
        }

        await conn.beginTransaction();
        transactionStarted = true;
        const problema = (await validarReferencias(conn, c, req.usuario)) || (await hayConflicto(conn, c, Number(id)));
        if (problema) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: problema });
        }
        await conn.query(
            `UPDATE cronograma
                SET id_disciplina = ?, id_escenario = ?, id_entrenador = ?, dia_semana = ?,
                    hora_inicio = ?, hora_fin = ?, vigencia_desde = ?, vigencia_hasta = ?
              WHERE id_cronograma = ?`,
            [c.id_disciplina, c.id_escenario, c.id_entrenador, c.dia_semana,
             c.hora_inicio, c.hora_fin, c.vigencia_desde, c.vigencia_hasta, id]
        );
        await conn.commit();
        res.json({ success: true, message: 'Cronograma actualizado' });
    } catch (error) {
        if (transactionStarted) await conn.rollback();
        if (error.code === SCHEMA_ERROR.code && error.statusCode === 503) {
            return res.status(503).json({ success: false, code: error.code, message: error.message });
        }
        return responderErrorInterno(res, 'cronogramas.actualizar', 'Error al actualizar el cronograma')(error);
    } finally {
        conn.release();
    }
};

// Dar de baja = activo FALSE (no se borra)
const darDeBajaCronograma = async (req, res) => {
    const { id } = req.params;
    try {
        await assertSchemaObjectsAvailable(db, ['cronograma'], SCHEMA_ERROR);
        const [[actual]] = await db.query('SELECT id_entrenador FROM cronograma WHERE id_cronograma = ? AND activo', [id]);
        if (!actual) return res.status(404).json({ success: false, message: 'Cronograma no encontrado' });
        if (req.usuario.rol === 'ENTRENADOR' && actual.id_entrenador !== req.usuario.id_persona) {
            return res.status(403).json({ success: false, message: 'Solo puedes dar de baja tus propios horarios' });
        }
        await db.query('UPDATE cronograma SET activo = FALSE WHERE id_cronograma = ?', [id]);
        res.json({ success: true, message: 'Cronograma dado de baja' });
    } catch (error) {
        if (error.code === SCHEMA_ERROR.code && error.statusCode === 503) {
            return res.status(503).json({ success: false, code: error.code, message: error.message });
        }
        return responderErrorInterno(res, 'cronogramas.baja', 'Error al dar de baja')(error);
    }
};

module.exports = { listarCronogramas, crearCronograma, actualizarCronograma, darDeBajaCronograma };