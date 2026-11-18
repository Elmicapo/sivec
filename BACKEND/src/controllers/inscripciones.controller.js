const db = require('../config/db');
const { configuracionCorreo, encolarCorreo } = require('../services/correo.service');
const { assertSchemaObjectsAvailable, SchemaNotReadyError } = require('../utils/schemaAvailability');

const MENSAJES_MYSQL = [
    {
        texto: 'no tiene cupos disponibles',
        mensaje: 'La disciplina no tiene cupos disponibles.'
    },
    {
        texto: 'se cruza en horario',
        mensaje: 'El deportista ya tiene una inscripción con cruce de horarios.'
    }
];

function mensajeDeReglaMySQL(error) {
    if (error?.sqlState !== '45000') return null;

    const detalle = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    const regla = MENSAJES_MYSQL.find(({ texto }) => detalle.includes(texto));
    return regla?.mensaje || 'La inscripción no cumple una regla de integridad.'
}

async function insertarInscripcion(database, idDeportista, idDisciplina) {
    const sql = "INSERT INTO inscripcion (id_deportista, id_disciplina, estado) VALUES (?, ?, 'ACTIVA')";
    const parametros = [idDeportista, idDisciplina];
    if (!configuracionCorreo()) return database.query(sql, parametros);

    const connection = await database.getConnection();
    try {
        await connection.beginTransaction();
        const resultado = await connection.query(sql, parametros);
        const [[contacto]] = await connection.query(
            'SELECT p.correo_electronico, d.nombre FROM persona p JOIN disciplina d ON d.id_disciplina = ? WHERE p.id_persona = ?',
            [idDisciplina, idDeportista]
        );
        await encolarCorreo(connection, {
            para: contacto?.correo_electronico,
            asunto: 'Inscripción confirmada en SIVEC',
            texto: `Tu inscripción en ${contacto?.nombre} quedó registrada. Puedes revisarla en Mi historial.`
        });
        await connection.commit();
        return resultado;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

function crearInscripcionesController({ database = db } = {}) {
    const inscribirDeportista = async (req, res) => {
        if (!req.usuario) {
            return res.status(401).json({ success: false, message: 'Debes iniciar sesión para inscribirte.' });
        }
        if (req.usuario.rol !== 'DEPORTISTA') {
            return res.status(403).json({ success: false, message: 'Solo los deportistas pueden inscribirse.' });
        }

        const idDeportista = Number(req.usuario.id_persona);
        const idDisciplina = Number(req.body?.id_disciplina);
        if (!Number.isSafeInteger(idDeportista) || idDeportista <= 0
            || !Number.isSafeInteger(idDisciplina) || idDisciplina <= 0) {
            return res.status(400).json({ success: false, message: 'El identificador de la disciplina no es válido.' });
        }

        try {
            await assertSchemaObjectsAvailable(database, ['deportista', 'disciplina', 'inscripcion']);
            const [perfil] = await database.query(
                'SELECT 1 FROM deportista WHERE id_persona = ? LIMIT 1',
                [idDeportista]
            );
            if (perfil.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El usuario no tiene un perfil de deportista.'
                });
            }

            const [disciplinas] = await database.query(
                'SELECT estado FROM disciplina WHERE id_disciplina = ? LIMIT 1',
                [idDisciplina]
            );
            if (disciplinas.length === 0) {
                return res.status(404).json({ success: false, message: 'La disciplina no existe.' });
            }
            if (disciplinas[0].estado !== 'ACTIVA') {
                return res.status(400).json({ success: false, message: 'La disciplina no está activa.' });
            }

            const [result] = await insertarInscripcion(database, idDeportista, idDisciplina);

            return res.status(201).json({
                success: true,
                message: 'Inscripción realizada con éxito.',
                id_inscripcion: result.insertId
            });
        } catch (error) {
            if (error instanceof SchemaNotReadyError) {
                return res.status(503).json({
                    success: false,
                    code: error.code,
                    message: 'El módulo de inscripciones aún no está habilitado.'
                });
            }
            if (error?.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    message: 'El deportista ya tiene una inscripción activa en esta disciplina.'
                });
            }

            const mensajeRegla = mensajeDeReglaMySQL(error);
            if (mensajeRegla) {
                return res.status(400).json({ success: false, message: mensajeRegla });
            }

            console.error('Error al procesar inscripción:', error?.code || 'UNKNOWN_ERROR');
            return res.status(500).json({
                success: false,
                message: 'No fue posible procesar la inscripción.'
            });
        }
    };

    return { inscribirDeportista };
}

module.exports = {
    ...crearInscripcionesController(),
    crearInscripcionesController,
    mensajeDeReglaMySQL
};
