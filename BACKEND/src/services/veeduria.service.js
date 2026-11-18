const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { assertMigrationsApplied: assertSchemaMigrationsApplied } = require('../utils/schemaAvailability');

const MAX_EVIDENCIAS = 5;
const MAX_BYTES_EVIDENCIA = 5 * 1024 * 1024;
const STORAGE_DIR = process.env.VEEDURIA_STORAGE_DIR
    || path.resolve(__dirname, '../../storage/private/veeduria');

const detectarImagen = (buffer) => {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { mime: 'image/jpeg', dimensiones: dimensionesJpeg(buffer), datos: quitarExifJpeg(buffer) };
    }
    if (buffer.length >= 24
        && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        return { mime: 'image/png', dimensiones: { ancho: buffer.readUInt32BE(16), alto: buffer.readUInt32BE(20) }, datos: quitarMetadatosPng(buffer) };
    }
    if (buffer.length >= 30 && buffer.subarray(0, 4).toString() === 'RIFF'
        && buffer.subarray(8, 12).toString() === 'WEBP') {
        return { mime: 'image/webp', dimensiones: dimensionesWebp(buffer), datos: quitarMetadatosWebp(buffer) };
    }
    throw new VeeduriaError(400, 'INVALID_EVIDENCE_FORMAT', 'Una evidencia no es una imagen JPG, PNG o WebP válida.');
};

const dimensionesJpeg = (buffer) => {
    let offset = 2;
    while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        const marker = buffer[offset + 1];
        offset += 2;
        if (marker === 0xd8 || marker === 0xd9) continue;
        if (offset + 2 > buffer.length) break;
        const length = buffer.readUInt16BE(offset);
        if (length < 2 || offset + length > buffer.length) break;
        if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
            || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
            return { alto: buffer.readUInt16BE(offset + 3), ancho: buffer.readUInt16BE(offset + 5) };
        }
        offset += length;
    }
    throw new VeeduriaError(400, 'INVALID_EVIDENCE_DIMENSIONS', 'No se pudieron leer las dimensiones de una evidencia.');
};

const dimensionesWebp = (buffer) => {
    const tipo = buffer.subarray(12, 16).toString();
    if (tipo === 'VP8X' && buffer.length >= 30) {
        return {
            ancho: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
            alto: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16)
        };
    }
    if (tipo === 'VP8 ' && buffer.length >= 30) {
        return { ancho: buffer.readUInt16LE(26) & 0x3fff, alto: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (tipo === 'VP8L' && buffer.length >= 25) {
        return {
            ancho: 1 + (((buffer[21] | (buffer[22] << 8)) & 0x3fff)),
            alto: 1 + ((((buffer[22] >> 6) | (buffer[23] << 2) | ((buffer[24] & 0x3f) << 10)) & 0x3fff))
        };
    }
    throw new VeeduriaError(400, 'INVALID_EVIDENCE_DIMENSIONS', 'No se pudieron leer las dimensiones de una evidencia.');
};

const quitarExifJpeg = (buffer) => {
    const partes = [buffer.subarray(0, 2)];
    let offset = 2;
    while (offset + 4 <= buffer.length && buffer[offset] === 0xff) {
        const marker = buffer[offset + 1];
        if (marker === 0xda) {
            partes.push(buffer.subarray(offset));
            return Buffer.concat(partes);
        }
        const length = buffer.readUInt16BE(offset + 2);
        if (length < 2 || offset + 2 + length > buffer.length) break;
        if (marker !== 0xe1) partes.push(buffer.subarray(offset, offset + 2 + length));
        offset += 2 + length;
    }
    return buffer;
};

const quitarMetadatosPng = (buffer) => {
    const partes = [buffer.subarray(0, 8)];
    let offset = 8;
    while (offset + 12 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const fin = offset + 12 + length;
        if (fin > buffer.length) return buffer;
        const tipo = buffer.subarray(offset + 4, offset + 8).toString();
        if (!['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(tipo)) partes.push(buffer.subarray(offset, fin));
        offset = fin;
    }
    return Buffer.concat(partes);
};

const quitarMetadatosWebp = (buffer) => {
    const partes = [buffer.subarray(0, 12)];
    let offset = 12;
    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32LE(offset + 4);
        const fin = offset + 8 + length;
        if (fin > buffer.length) return buffer;
        const tipo = buffer.subarray(offset, offset + 4).toString();
        if (!['EXIF', 'XMP ', 'ICCP'].includes(tipo)) {
            partes.push(buffer.subarray(offset, fin + (length % 2)));
        }
        offset = fin + (length % 2);
    }
    const resultado = Buffer.concat(partes);
    resultado.writeUInt32LE(resultado.length - 8, 4);
    return resultado;
};

class VeeduriaError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

const createVeeduriaService = (pool) => {
    const assertMigrationsApplied = async (connection) => {
        await assertSchemaMigrationsApplied(connection, ['001', '002', '003'], {
            code: 'VEEDURIA_SCHEMA_NOT_READY',
            message: 'El esquema de veeduría aún no está migrado.',
            createError: (code, message) => new VeeduriaError(503, code, message)
        });
    };

    const assertScenarioMigrationsApplied = async (connection) => {
        await assertSchemaMigrationsApplied(connection, ['001', '002', '005'], {
            code: 'VEEDURIA_SCHEMA_NOT_READY',
            message: 'El esquema de propuestas de escenarios aún no está migrado.',
            createError: (code, message) => new VeeduriaError(503, code, message)
        });
    };

    const withTransaction = async (operation, assertSchema = assertMigrationsApplied) => {
        const connection = await pool.getConnection();
        let started = false;

        try {
            await connection.beginTransaction();
            started = true;
            await assertSchema(connection);
            const result = await operation(connection);
            await connection.commit();
            return result;
        } catch (error) {
            if (started) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error('Error al revertir transacción de veeduría:', rollbackError.message);
                }
            }
            throw error;
        } finally {
            connection.release();
        }
    };

    const assertCmj = async (connection, idPersona) => {
        const [rows] = await connection.query(
            'SELECT id_persona FROM cmj_consejero WHERE id_persona = ?',
            [idPersona]
        );
        if (!rows.length) {
            throw new VeeduriaError(403, 'CMJ_PROFILE_REQUIRED', 'El usuario no tiene un perfil CMJ activo.');
        }
    };

    const obtenerFechaUtc = async (connection) => {
        const [[row]] = await connection.query('SELECT UTC_TIMESTAMP() AS fecha_utc');
        return row.fecha_utc;
    };

    const toUtcIso = (value) => {
        if (value instanceof Date) return value.toISOString();
        const valueAsString = String(value).replace(' ', 'T');
        return valueAsString.endsWith('Z') ? valueAsString : `${valueAsString}Z`;
    };

    return {
        async crearSolicitudEscenario(datos) {
            return withTransaction(async (connection) => {
                const [disciplinas] = await connection.query(
                    'SELECT id_disciplina FROM disciplina WHERE id_disciplina = ? AND estado = ?',
                    [datos.id_disciplina, 'ACTIVA']
                );
                if (!disciplinas.length) {
                    throw new VeeduriaError(404, 'DISCIPLINE_NOT_FOUND', 'La disciplina seleccionada no existe o está inactiva.');
                }
                const fechaUtc = await obtenerFechaUtc(connection);
                const [result] = await connection.query(
                    `INSERT INTO solicitud_escenario
                        (nombre_escenario, tipo_escenario, id_disciplina, zona, comuna, barrio,
                         corregimiento, localidad_rural, tipo_localidad, tipo_ubicacion,
                         latitud, longitud, fecha_solicitud)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        datos.nombre_escenario, datos.tipo_escenario, datos.id_disciplina, datos.zona,
                        datos.comuna, datos.barrio, datos.corregimiento,
                        datos.localidad_rural, datos.tipo_localidad, datos.tipo_ubicacion,
                        datos.latitud, datos.longitud, fechaUtc
                    ]
                );
                await connection.query(
                    `INSERT INTO solicitud_escenario_historial
                        (id_solicitud_escenario, estado_anterior, estado_nuevo, id_cmj, observacion, fecha_evento)
                     VALUES (?, NULL, 'PENDIENTE', NULL, NULL, ?)`,
                    [result.insertId, fechaUtc]
                );
                return { id_solicitud_escenario: result.insertId, estado_revision: 'PENDIENTE' };
            }, assertScenarioMigrationsApplied);
        },

        async obtenerSolicitudesEscenarioPendientes() {
            await assertScenarioMigrationsApplied(pool);
            const [rows] = await pool.query(
                `SELECT s.id_solicitud_escenario, s.nombre_escenario, s.tipo_escenario, s.id_disciplina,
                        d.nombre AS disciplina, s.zona, s.comuna, s.barrio,
                        s.corregimiento, s.localidad_rural, s.tipo_localidad,
                        s.tipo_ubicacion, s.latitud, s.longitud, s.fecha_solicitud
                   FROM solicitud_escenario s
                   JOIN disciplina d ON d.id_disciplina = s.id_disciplina
                  WHERE s.estado_revision = 'PENDIENTE'
                  ORDER BY s.fecha_solicitud ASC, s.id_solicitud_escenario ASC`
            );
            return rows;
        },

        async resolverSolicitudEscenario({ idSolicitud, estado, idCmj, observacion }) {
            return withTransaction(async (connection) => {
                await assertCmj(connection, idCmj);
                const [solicitudes] = await connection.query(
                    `SELECT s.*, d.nombre AS disciplina
                       FROM solicitud_escenario s
                       JOIN disciplina d ON d.id_disciplina = s.id_disciplina
                      WHERE s.id_solicitud_escenario = ?
                      FOR UPDATE`,
                    [idSolicitud]
                );
                if (!solicitudes.length) {
                    throw new VeeduriaError(404, 'SCENARIO_REQUEST_NOT_FOUND', 'La solicitud de escenario no existe.');
                }
                const solicitud = solicitudes[0];
                if (solicitud.estado_revision !== 'PENDIENTE') {
                    throw new VeeduriaError(409, 'SCENARIO_REQUEST_ALREADY_RESOLVED', 'La solicitud de escenario ya fue resuelta.');
                }
                if (estado === 'APROBADA' && !solicitud.tipo_escenario) {
                    throw new VeeduriaError(409, 'SCENARIO_TYPE_REQUIRED', 'La solicitud antigua requiere tipo físico antes de aprobarse.');
                }
                const fechaUtc = await obtenerFechaUtc(connection);
                let idEscenario = null;
                if (estado === 'APROBADA') {
                    const ubicacion = solicitud.zona === 'URBANA'
                        ? `${solicitud.comuna} - ${solicitud.barrio}`
                        : `${solicitud.corregimiento} - ${solicitud.localidad_rural}`;
                    const [escenario] = await connection.query(
                        `INSERT INTO escenario
                            (nombre, ubicacion, zona, tipo_localidad, tipo_ubicacion,
                             comuna, barrio, corregimiento, localidad_rural,
                             latitud, longitud, tipo, estado_semaforo, fecha_ultima_actualizacion, activo)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERDE', ?, 1)`,
                        [
                            solicitud.nombre_escenario, ubicacion, solicitud.zona,
                            solicitud.tipo_localidad, solicitud.tipo_ubicacion,
                            solicitud.comuna, solicitud.barrio, solicitud.corregimiento,
                            solicitud.localidad_rural, solicitud.latitud, solicitud.longitud,
                            solicitud.tipo_escenario, fechaUtc
                        ]
                    );
                    idEscenario = escenario.insertId;
                    await connection.query(
                        'INSERT INTO disciplina_escenario (id_disciplina, id_escenario) VALUES (?, ?)',
                        [solicitud.id_disciplina, idEscenario]
                    );
                }
                await connection.query(
                    `UPDATE solicitud_escenario
                        SET estado_revision = ?, id_cmj_revisa = ?, fecha_revision = ?,
                            observacion_cmj = ?, id_escenario = ?
                      WHERE id_solicitud_escenario = ? AND estado_revision = 'PENDIENTE'`,
                    [estado, idCmj, fechaUtc, observacion, idEscenario, idSolicitud]
                );
                await connection.query(
                    `INSERT INTO solicitud_escenario_historial
                        (id_solicitud_escenario, estado_anterior, estado_nuevo, id_cmj, observacion, fecha_evento)
                     VALUES (?, 'PENDIENTE', ?, ?, ?, ?)`,
                    [idSolicitud, estado, idCmj, observacion, fechaUtc]
                );
                return { id_solicitud_escenario: idSolicitud, estado_revision: estado, id_escenario: idEscenario };
            }, assertScenarioMigrationsApplied);
        },

        async crearReporte(datos) {
            const codigoSeguimiento = crypto.randomBytes(32).toString('hex');
            const codigoHash = crypto.createHash('sha256').update(codigoSeguimiento).digest();

            const archivosCreados = [];
            let idReporte;
            try {
                idReporte = await withTransaction(async (connection) => {
                const [escenarios] = await connection.query(
                    'SELECT id_escenario FROM escenario WHERE id_escenario = ? FOR UPDATE',
                    [datos.id_escenario]
                );
                if (!escenarios.length) {
                    throw new VeeduriaError(404, 'SCENARIO_NOT_FOUND', 'El escenario seleccionado no existe.');
                }

                const fechaUtc = await obtenerFechaUtc(connection);
                const [reporte] = await connection.query(
                    `INSERT INTO reporte_veeduria
                        (id_escenario, id_reportante, estado_propuesto, descripcion, estado_reporte, fecha_reporte)
                     VALUES (?, NULL, ?, ?, 'PENDIENTE', ?)`,
                    [datos.id_escenario, datos.estado_propuesto, datos.descripcion, fechaUtc]
                );

                await connection.query(
                    `INSERT INTO reporte_veeduria_historial
                        (id_reporte, estado_anterior, estado_nuevo, id_cmj, observacion, fecha_evento)
                     VALUES (?, NULL, 'PENDIENTE', NULL, NULL, ?)`,
                    [reporte.insertId, fechaUtc]
                );

                const [solicitud] = await connection.query(
                    `INSERT INTO solicitud_veeduria
                        (codigo_seguimiento_hash, nombre_contacto, correo_contacto,
                         id_escenario, id_solicitud_escenario, estado_propuesto, descripcion,
                         id_reporte, fecha_recepcion)
                     VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
                    [
                        codigoHash,
                        datos.nombre_completo,
                        datos.correo_electronico,
                        datos.id_escenario,
                        datos.estado_propuesto,
                        datos.descripcion,
                        reporte.insertId,
                        fechaUtc
                    ]
                );

                if (Array.isArray(datos.evidencias) && (datos.evidencias.length < 1
                    || datos.evidencias.length > MAX_EVIDENCIAS)) {
                    throw new VeeduriaError(400, 'INVALID_EVIDENCE_COUNT', 'El reporte debe incluir entre una y cinco fotografías.');
                }
                if (Array.isArray(datos.evidencias)) await fs.mkdir(STORAGE_DIR, { recursive: true });
                for (const [index, evidencia] of (datos.evidencias || []).entries()) {
                    const contenido = Buffer.from(evidencia.contenido, 'base64');
                    if (!contenido.length || contenido.length > MAX_BYTES_EVIDENCIA) {
                        throw new VeeduriaError(400, 'INVALID_EVIDENCE_SIZE', 'Cada fotografía debe pesar máximo 5 MB.');
                    }
                    const imagen = detectarImagen(contenido);
                    if (imagen.dimensiones.ancho < 1 || imagen.dimensiones.alto < 1
                        || imagen.dimensiones.ancho > 1920 || imagen.dimensiones.alto > 1920) {
                        throw new VeeduriaError(400, 'INVALID_EVIDENCE_DIMENSIONS', 'Cada fotografía debe medir máximo 1920 × 1920 píxeles.');
                    }
                    const clave = `${crypto.randomUUID()}.${imagen.mime.split('/')[1]}`;
                    await fs.writeFile(path.join(STORAGE_DIR, clave), imagen.datos, { flag: 'wx' });
                    archivosCreados.push(path.join(STORAGE_DIR, clave));
                    const fechaEvidencia = await obtenerFechaUtc(connection);
                    await connection.query(
                        `INSERT INTO evidencia_veeduria
                            (id_solicitud_veeduria, orden, clave_objeto_privado, mime_real,
                             bytes_original, bytes_optimizada, ancho, alto, sha256,
                             exif_eliminado, fecha_registro)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                        [
                            solicitud.insertId,
                            index + 1,
                            clave,
                            imagen.mime,
                            contenido.length,
                            imagen.datos.length,
                            imagen.dimensiones.ancho,
                            imagen.dimensiones.alto,
                            crypto.createHash('sha256').update(imagen.datos).digest(),
                            fechaEvidencia
                        ]
                    );
                }
                    return reporte.insertId;
                });
            } catch (error) {
                await Promise.all(archivosCreados.map((archivo) => fs.unlink(archivo).catch(() => undefined)));
                throw error;
            }

            return {
                id_reporte: idReporte,
                codigo_seguimiento: codigoSeguimiento
            };
        },

        async obtenerSeguimiento(codigoSeguimiento) {
            const codigoHash = crypto.createHash('sha256').update(codigoSeguimiento).digest();
            await assertMigrationsApplied(pool);
            const [rows] = await pool.query(
                `SELECT s.id_reporte, s.estado_propuesto, s.descripcion,
                        s.fecha_recepcion, r.estado_reporte, r.fecha_validacion,
                        r.observacion_cmj, e.id_escenario, e.nombre AS escenario,
                        r.fecha_oficializacion
                   FROM solicitud_veeduria s
                   JOIN reporte_veeduria r ON r.id_reporte = s.id_reporte
                   JOIN escenario e ON e.id_escenario = r.id_escenario
                  WHERE s.codigo_seguimiento_hash = ?`,
                [codigoHash]
            );
            if (!rows.length) {
                throw new VeeduriaError(404, 'TRACKING_NOT_FOUND', 'No encontramos un reporte con ese código de seguimiento.');
            }
            return rows[0];
        },

        async obtenerEvidencia(idReporte, orden) {
            await assertMigrationsApplied(pool);
            const [rows] = await pool.query(
                `SELECT ev.clave_objeto_privado, ev.mime_real
                   FROM evidencia_veeduria ev
                   JOIN solicitud_veeduria sv
                     ON sv.id_solicitud_veeduria = ev.id_solicitud_veeduria
                  WHERE sv.id_reporte = ? AND ev.orden = ?`,
                [idReporte, orden]
            );
            if (!rows.length) {
                throw new VeeduriaError(404, 'EVIDENCE_NOT_FOUND', 'La evidencia solicitada no existe.');
            }
            return {
                ruta: path.join(STORAGE_DIR, rows[0].clave_objeto_privado),
                mime: rows[0].mime_real
            };
        },

        async obtenerPendientes() {
            await assertMigrationsApplied(pool);
            const [rows] = await pool.query(
                `SELECT r.id_reporte, r.id_escenario, e.nombre AS escenario,
                        r.estado_propuesto, r.descripcion, r.fecha_reporte, r.estado_reporte
                   FROM reporte_veeduria r
                   JOIN escenario e ON e.id_escenario = r.id_escenario
                  WHERE r.estado_reporte = 'PENDIENTE'
                  ORDER BY r.fecha_reporte ASC, r.id_reporte ASC`
            );
            return rows;
        },

        async obtenerPendientesOficializacion() {
            await assertMigrationsApplied(pool);
            const [rows] = await pool.query(
                `SELECT r.id_reporte, r.id_escenario, e.nombre AS escenario,
                        e.estado_semaforo AS estado_actual, r.estado_propuesto, r.fecha_reporte
                   FROM reporte_veeduria r
                   JOIN escenario e ON e.id_escenario = r.id_escenario
                  WHERE r.estado_reporte = 'VALIDADO'
                    AND r.id_cmj_valida IS NOT NULL AND r.fecha_validacion IS NOT NULL
                    AND r.id_cmj_oficializa IS NULL AND r.fecha_oficializacion IS NULL
                    AND NOT EXISTS (
                      SELECT 1 FROM historial_estado_escenario h
                       WHERE h.id_reporte = r.id_reporte
                    )
                  ORDER BY r.fecha_validacion ASC, r.id_reporte ASC`
            );
            return rows;
        },

        async obtenerDetalle(idReporte) {
            await assertMigrationsApplied(pool);
            const [rows] = await pool.query(
                `SELECT r.id_reporte, r.id_escenario, e.nombre AS escenario,
                        r.estado_propuesto, r.descripcion, r.fecha_reporte, r.estado_reporte,
                        r.id_cmj_valida, pv.nombre_completo AS validado_por,
                        r.fecha_validacion, r.observacion_cmj,
                        r.id_cmj_oficializa, po.nombre_completo AS oficializado_por,
                        r.fecha_oficializacion, sv.nombre_contacto, sv.correo_contacto
                   FROM reporte_veeduria r
                   JOIN escenario e ON e.id_escenario = r.id_escenario
                   LEFT JOIN persona pv ON pv.id_persona = r.id_cmj_valida
                   LEFT JOIN cmj_consejero co ON co.id_persona = r.id_cmj_oficializa
                   LEFT JOIN persona po ON po.id_persona = co.id_persona
                   LEFT JOIN solicitud_veeduria sv ON sv.id_reporte = r.id_reporte
                  WHERE r.id_reporte = ?`,
                [idReporte]
            );
            if (!rows.length) {
                throw new VeeduriaError(404, 'REPORT_NOT_FOUND', 'El reporte solicitado no existe.');
            }

            const [events] = await pool.query(
                `SELECT h.estado_anterior, h.estado_nuevo, h.observacion,
                        h.fecha_evento, h.id_cmj, p.nombre_completo AS actor
                   FROM reporte_veeduria_historial h
                   LEFT JOIN cmj_consejero c ON c.id_persona = h.id_cmj
                   LEFT JOIN persona p ON p.id_persona = c.id_persona
                  WHERE h.id_reporte = ?
                  ORDER BY h.fecha_evento ASC, h.id_historial_reporte ASC`,
                [idReporte]
            );

            const [evidencias] = await pool.query(
                `SELECT ev.orden
                   FROM evidencia_veeduria ev
                   JOIN solicitud_veeduria sv ON sv.id_solicitud_veeduria = ev.id_solicitud_veeduria
                  WHERE sv.id_reporte = ?
                  ORDER BY ev.orden`,
                [idReporte]
            );

            return { ...rows[0], historial_decisiones: events, evidencias };
        },

        async obtenerHistorialEscenario(idEscenario) {
            await assertMigrationsApplied(pool);
            const [rows] = await pool.query(
                `SELECT r.id_reporte, r.estado_propuesto, r.descripcion, r.fecha_reporte,
                        r.estado_reporte, r.id_cmj_valida, pv.nombre_completo AS validado_por,
                        r.fecha_validacion, r.observacion_cmj, r.id_cmj_oficializa,
                        po.nombre_completo AS oficializado_por, r.fecha_oficializacion,
                        h.estado_anterior, h.estado_nuevo AS estado_oficializado,
                        h.fecha_cambio AS fecha_cambio_semaforo
                   FROM reporte_veeduria r
                   LEFT JOIN persona pv ON pv.id_persona = r.id_cmj_valida
                   LEFT JOIN cmj_consejero co ON co.id_persona = r.id_cmj_oficializa
                   LEFT JOIN persona po ON po.id_persona = co.id_persona
                   LEFT JOIN historial_estado_escenario h ON h.id_reporte = r.id_reporte
                  WHERE r.id_escenario = ?
                  ORDER BY r.fecha_reporte DESC, r.id_reporte DESC`,
                [idEscenario]
            );
            return rows;
        },

        async validarReporte({ idReporte, estado, observacion, idCmj }) {
            return withTransaction(async (connection) => {
                await assertCmj(connection, idCmj);

                const [reports] = await connection.query(
                    `SELECT id_reporte, estado_reporte
                       FROM reporte_veeduria
                      WHERE id_reporte = ?
                      FOR UPDATE`,
                    [idReporte]
                );
                if (!reports.length) {
                    throw new VeeduriaError(404, 'REPORT_NOT_FOUND', 'El reporte solicitado no existe.');
                }
                if (reports[0].estado_reporte !== 'PENDIENTE') {
                    throw new VeeduriaError(409, 'REPORT_ALREADY_PROCESSED', 'El reporte ya fue procesado.');
                }

                const fechaUtc = await obtenerFechaUtc(connection);
                const [updated] = await connection.query(
                    `UPDATE reporte_veeduria
                        SET estado_reporte = ?, id_cmj_valida = ?, fecha_validacion = ?, observacion_cmj = ?
                      WHERE id_reporte = ? AND estado_reporte = 'PENDIENTE'`,
                    [estado, idCmj, fechaUtc, observacion, idReporte]
                );
                if (updated.affectedRows !== 1) {
                    throw new VeeduriaError(409, 'REPORT_ALREADY_PROCESSED', 'El reporte ya fue procesado.');
                }

                await connection.query(
                    `INSERT INTO reporte_veeduria_historial
                        (id_reporte, estado_anterior, estado_nuevo, id_cmj, observacion, fecha_evento)
                     VALUES (?, 'PENDIENTE', ?, ?, ?, ?)`,
                    [idReporte, estado, idCmj, observacion, fechaUtc]
                );

                return { id_reporte: idReporte, estado_reporte: estado, fecha_validacion: toUtcIso(fechaUtc) };
            });
        },

        async oficializarReporte({ idReporte, idCmj }) {
            return withTransaction(async (connection) => {
                await assertCmj(connection, idCmj);

                const [reports] = await connection.query(
                    `SELECT id_reporte, id_escenario, estado_propuesto, estado_reporte,
                            id_cmj_valida, fecha_validacion, id_cmj_oficializa, fecha_oficializacion
                       FROM reporte_veeduria
                      WHERE id_reporte = ?
                      FOR UPDATE`,
                    [idReporte]
                );
                if (!reports.length) {
                    throw new VeeduriaError(404, 'REPORT_NOT_FOUND', 'El reporte solicitado no existe.');
                }

                const report = reports[0];
                if (report.estado_reporte !== 'VALIDADO' || !report.id_cmj_valida || !report.fecha_validacion) {
                    throw new VeeduriaError(409, 'REPORT_NOT_VALIDATED', 'Solo se puede oficializar un reporte validado.');
                }
                if (report.id_cmj_oficializa || report.fecha_oficializacion) {
                    if (!report.id_cmj_oficializa || !report.fecha_oficializacion) {
                        throw new VeeduriaError(409, 'OFFICIALIZATION_INTEGRITY_CONFLICT', 'Las marcas de oficialización son inconsistentes.');
                    }
                    throw new VeeduriaError(409, 'ALREADY_OFFICIALIZED', 'El reporte ya fue oficializado.');
                }

                const [existingHistory] = await connection.query(
                    'SELECT id_historial FROM historial_estado_escenario WHERE id_reporte = ? FOR UPDATE',
                    [idReporte]
                );
                if (existingHistory.length) {
                    throw new VeeduriaError(409, 'LEGACY_HISTORY_EXISTS', 'El reporte tiene historial legado y requiere revisión.');
                }

                const [scenarios] = await connection.query(
                    `SELECT id_escenario, estado_semaforo
                       FROM escenario
                      WHERE id_escenario = ?
                      FOR UPDATE`,
                    [report.id_escenario]
                );
                if (!scenarios.length) {
                    throw new VeeduriaError(409, 'SCENARIO_INTEGRITY_CONFLICT', 'El escenario asociado ya no existe.');
                }

                const estadoAnterior = scenarios[0].estado_semaforo;
                const fechaUtc = await obtenerFechaUtc(connection);

                await connection.query(
                    `UPDATE escenario
                        SET estado_semaforo = ?, fecha_ultima_actualizacion = ?
                      WHERE id_escenario = ?`,
                    [report.estado_propuesto, fechaUtc, report.id_escenario]
                );
                await connection.query(
                    `INSERT INTO historial_estado_escenario
                        (id_escenario, id_reporte, estado_anterior, estado_nuevo, id_cmj, fecha_cambio)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        report.id_escenario,
                        idReporte,
                        estadoAnterior,
                        report.estado_propuesto,
                        idCmj,
                        fechaUtc
                    ]
                );

                const [updated] = await connection.query(
                    `UPDATE reporte_veeduria
                        SET id_cmj_oficializa = ?, fecha_oficializacion = ?
                      WHERE id_reporte = ? AND id_cmj_oficializa IS NULL AND fecha_oficializacion IS NULL`,
                    [idCmj, fechaUtc, idReporte]
                );
                if (updated.affectedRows !== 1) {
                    throw new VeeduriaError(409, 'ALREADY_OFFICIALIZED', 'El reporte ya fue oficializado.');
                }

                return {
                    id_reporte: idReporte,
                    estado_anterior: estadoAnterior,
                    estado_oficial: report.estado_propuesto,
                    fecha_oficializacion: toUtcIso(fechaUtc),
                    estado_sin_cambio: estadoAnterior === report.estado_propuesto
                };
            });
        }
    };
};

module.exports = { createVeeduriaService, VeeduriaError };
