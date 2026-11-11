const db = require('../config/db');
const { responderErrorInterno, registrarError } = require('../utils/safeError');
const { assertSchemaObjectsAvailable, SchemaNotReadyError } = require('../utils/schemaAvailability');

const responderEsquemaNoDisponible = (res, error, message) => {
    if (!(error instanceof SchemaNotReadyError)) return false;
    res.status(503).json({ success: false, code: error.code, message });
    return true;
};

const obtenerDisciplinasActivas = async (req, res) => {
    try {
        await assertSchemaObjectsAvailable(db, [{ name: 'v_rep_disciplinas_activas', type: 'VIEW' }]);
        const [disciplinas] = await db.query('SELECT * FROM v_rep_disciplinas_activas');
        res.json({ success: true, data: disciplinas });
    } catch (error) {
        if (responderEsquemaNoDisponible(res, error, 'El catálogo de disciplinas aún no está habilitado.')) return;
        return responderErrorInterno(res, 'disciplinas.listar', 'Error al consultar disciplinas')(error);
    }
};

// Cronograma con filtros opcionales: ?id_escenario=1&id_entrenador=1&id_disciplina=1
const obtenerCronogramaConsolidado = async (req, res) => {
    const { id_escenario, id_entrenador, id_disciplina } = req.query;
    let sql = 'SELECT * FROM v_cronograma_consolidado WHERE 1=1';
    const params = [];
    if (id_escenario)  { sql += ' AND id_escenario = ?';  params.push(id_escenario); }
    if (id_entrenador) { sql += ' AND id_entrenador = ?'; params.push(id_entrenador); }
    if (id_disciplina) { sql += ' AND id_disciplina = ?'; params.push(id_disciplina); }

    try {
        await assertSchemaObjectsAvailable(db, [{ name: 'v_cronograma_consolidado', type: 'VIEW' }]);
        const [data] = await db.query(sql, params);
        res.json({ success: true, data });
    } catch (error) {
        if (responderEsquemaNoDisponible(res, error, 'El cronograma consolidado aún no está habilitado.')) return;
        return responderErrorInterno(res, 'disciplinas.cronograma', 'Error al consultar el cronograma')(error);
    }
};


const crearHistorialDeportistaController = ({ database = db } = {}) => async (req, res) => {
    try {
        await assertSchemaObjectsAvailable(database, [{ name: 'v_historial_deportista', type: 'VIEW' }]);
        const [historial] = await database.query(
            'SELECT * FROM v_historial_deportista WHERE id_deportista = ?',
            [req.usuario.id_persona]
        );
        res.json({ success: true, data: historial });
    } catch (error) {
        if (responderEsquemaNoDisponible(res, error, 'El historial de deportistas aún no está habilitado.')) return;
        console.error('Error al consultar historial:', error?.code || 'UNKNOWN_ERROR');
        res.status(500).json({ success: false, message: 'No fue posible consultar el historial.' });
    }
};

const obtenerHistorialDeportista = crearHistorialDeportistaController();

// Búsqueda pública: ?nombre=futbol&categoria=DEPORTIVA&ubicacion=coliseo
const buscarDisciplinas = async (req, res) => {
    const { nombre, categoria, ubicacion } = req.query;
    let sql = `SELECT d.id_disciplina, d.nombre, d.categoria, d.poblacion_objetivo, d.cupo_maximo,
                      (SELECT COUNT(*) FROM inscripcion i
                        WHERE i.id_disciplina = d.id_disciplina AND i.estado = 'ACTIVA') AS inscritos,
                      (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ')
                         FROM disciplina_escenario de
                         JOIN escenario e ON e.id_escenario = de.id_escenario
                        WHERE de.id_disciplina = d.id_disciplina) AS escenarios
               FROM disciplina d
               WHERE d.estado = 'ACTIVA'`;
    const params = [];

    if (nombre)    { sql += ' AND d.nombre LIKE ?'; params.push(`%${nombre}%`); }
    if (categoria) { sql += ' AND d.categoria = ?'; params.push(categoria); }
    if (ubicacion) {
        sql += ` AND EXISTS (SELECT 1 FROM disciplina_escenario de2
                             JOIN escenario e2 ON e2.id_escenario = de2.id_escenario
                             WHERE de2.id_disciplina = d.id_disciplina
                               AND (e2.nombre LIKE ? OR e2.ubicacion LIKE ?))`;
        params.push(`%${ubicacion}%`, `%${ubicacion}%`);
    }
    sql += ' ORDER BY d.categoria, d.nombre';

    try {
        await assertSchemaObjectsAvailable(db, [
            'disciplina',
            'inscripcion',
            'disciplina_escenario',
            'escenario'
        ]);
        const [data] = await db.query(sql, params);
        res.json({ success: true, data });
    } catch (error) {
        if (responderEsquemaNoDisponible(res, error, 'La búsqueda de disciplinas aún no está habilitada.')) return;
        return responderErrorInterno(res, 'disciplinas.buscar', 'Error en la búsqueda')(error);
    }
};


const crearDisciplina = async (req, res) => {
    const { nombre, categoria, poblacion_objetivo, cupo_maximo } = req.body;
    if (!nombre || !['DEPORTIVA', 'CULTURAL'].includes(categoria) || !(cupo_maximo > 0)) {
        return res.status(400).json({ success: false, message: 'Nombre, categoría (DEPORTIVA/CULTURAL) y cupo mayor a 0 son obligatorios' });
    }
    try {
        await assertSchemaObjectsAvailable(db, ['disciplina']);
        const [r] = await db.query(
            'INSERT INTO disciplina (nombre, categoria, poblacion_objetivo, cupo_maximo) VALUES (?, ?, ?, ?)',
            [nombre, categoria, poblacion_objetivo || null, cupo_maximo]);
        res.status(201).json({ success: true, message: 'Disciplina creada', id_disciplina: r.insertId });
    } catch (error) {
        if (responderEsquemaNoDisponible(res, error, 'El módulo de disciplinas aún no está habilitado.')) return;
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Ya existe una disciplina con ese nombre' });
        }
        return responderErrorInterno(res, 'disciplinas.crear', 'Error al crear la disciplina')(error);
    }
};

const actualizarDisciplina = async (req, res) => {
    const { id } = req.params;
    const { nombre, categoria, poblacion_objetivo, cupo_maximo } = req.body;
    if (categoria && !['DEPORTIVA', 'CULTURAL'].includes(categoria)) {
        return res.status(400).json({ success: false, message: 'Categoría inválida' });
    }
    try {
        await assertSchemaObjectsAvailable(db, ['disciplina', 'inscripcion']);
        if (cupo_maximo) {
            const [[{ n }]] = await db.query(
                "SELECT COUNT(*) AS n FROM inscripcion WHERE id_disciplina = ? AND estado = 'ACTIVA'", [id]);
            if (cupo_maximo < n) {
                return res.status(400).json({ success: false, message: `Hay ${n} inscritos activos; el cupo no puede ser menor` });
            }
        }
        const [r] = await db.query(
            `UPDATE disciplina SET nombre = COALESCE(?, nombre), categoria = COALESCE(?, categoria),
                    poblacion_objetivo = COALESCE(?, poblacion_objetivo), cupo_maximo = COALESCE(?, cupo_maximo)
             WHERE id_disciplina = ?`,
            [nombre || null, categoria || null, poblacion_objetivo || null, cupo_maximo || null, id]);
        if (r.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Disciplina no encontrada' });
        }
        res.json({ success: true, message: 'Disciplina actualizada' });
    } catch (error) {
        if (responderEsquemaNoDisponible(res, error, 'El módulo de disciplinas aún no está habilitado.')) return;
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Ya existe una disciplina con ese nombre' });
        }
        return responderErrorInterno(res, 'disciplinas.actualizar', 'Error al actualizar')(error);
    }
};

// Dar de baja = pasa a INACTIVA (no se borra) y se apagan sus cronogramas
const darDeBajaDisciplina = async (req, res) => {
    const { id } = req.params;
    const conn = await db.getConnection();
    try {
        await assertSchemaObjectsAvailable(conn, ['disciplina', 'cronograma']);
        await conn.beginTransaction();
        const [r] = await conn.query("UPDATE disciplina SET estado = 'INACTIVA' WHERE id_disciplina = ?", [id]);
        if (r.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Disciplina no encontrada' });
        }
        await conn.query('UPDATE cronograma SET activo = FALSE WHERE id_disciplina = ?', [id]);
        await conn.commit();
        res.json({ success: true, message: 'Disciplina dada de baja' });
    } catch (error) {
        await conn.rollback();
        if (responderEsquemaNoDisponible(res, error, 'El módulo de disciplinas aún no está habilitado.')) return;
        return responderErrorInterno(res, 'disciplinas.baja', 'Error al dar de baja')(error);
    } finally {
        conn.release();
    }
};

// Crear un nuevo cronograma
const crearCronograma = async (req, res) => {
    try {
        await assertSchemaObjectsAvailable(db, ['cronograma']);
        const { id_disciplina, id_escenario, id_entrenador, dia_semana, hora_inicio, hora_fin, vigencia_desde, vigencia_hasta } = req.body;

        // Inserción directa. Los triggers de MySQL validarán los cruces de horario automáticamente.
        const [result] = await db.query(
            `INSERT INTO cronograma 
            (id_disciplina, id_escenario, id_entrenador, dia_semana, hora_inicio, hora_fin, vigencia_desde, vigencia_hasta, activo) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [id_disciplina, id_escenario, id_entrenador, dia_semana, hora_inicio, hora_fin, vigencia_desde, vigencia_hasta || null]
        );

        res.status(201).json({ success: true, message: 'Cronograma creado con éxito.', id_cronograma: result.insertId });
    } catch (error) {
        if (responderEsquemaNoDisponible(res, error, 'El módulo de cronogramas aún no está habilitado.')) return;
        // 45000 es el código de error que configuramos en el trigger de MySQL para los cruces
        if (error.sqlState === '45000') {
            registrarError('disciplinas.cronograma.regla', error);
            return res.status(400).json({
                success: false,
                message: 'El cronograma entra en conflicto con otro horario registrado.'
            });
        }
        return responderErrorInterno(res, 'disciplinas.cronograma.crear', 'Error interno del servidor.')(error);
    }
};

// Dar de baja (desactivar) un cronograma
const darDeBajaCronograma = async (req, res) => {
    try {
        const { id } = req.params;
        await assertSchemaObjectsAvailable(db, ['cronograma']);
        await db.query('UPDATE cronograma SET activo = FALSE WHERE id_cronograma = ?', [id]);
        res.json({ success: true, message: 'Cronograma desactivado con éxito.' });
    } catch (error) {
        if (responderEsquemaNoDisponible(res, error, 'El módulo de cronogramas aún no está habilitado.')) return;
        res.status(500).json({ success: false, message: 'Error desactivando el cronograma.' });
    }
};


module.exports = {
    obtenerDisciplinasActivas,
    obtenerCronogramaConsolidado,
    obtenerHistorialDeportista,
    buscarDisciplinas,
    crearHistorialDeportistaController,
    crearDisciplina,
    actualizarDisciplina,
    darDeBajaDisciplina,
    crearCronograma,
    darDeBajaCronograma
};