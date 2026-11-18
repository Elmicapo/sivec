const db = require('../config/db');
const { createVeeduriaService, VeeduriaError } = require('../services/veeduria.service');
const { registrarError } = require('../utils/safeError');

const service = createVeeduriaService(db);
const ESTADOS = new Set(['VERDE', 'AMARILLO', 'ROJO']);
const TIPOS_ESCENARIO = new Set([
    'CANCHA', 'COLISEO', 'ESTADIO', 'PARQUE', 'PLACA_POLIDEPORTIVA', 'OTRO'
]);
const MAX_INT = 2147483647;

const responderError = (res, error, message) => {
    if (error instanceof VeeduriaError) {
        return res.status(error.statusCode).json({
            success: false,
            code: error.code,
            message: error.message
        });
    }
    registrarError(`veeduria.${message}`, error);
    return res.status(500).json({ success: false, message: 'Error interno al procesar la solicitud.' });
};

const validarId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 && id <= MAX_INT ? id : null;
};

const validarReportePublico = (body = {}) => {
    const idEscenario = validarId(body.id_escenario);
    const nombre = typeof body.nombre_completo === 'string' ? body.nombre_completo.trim() : '';
    const correo = typeof body.correo_electronico === 'string'
        ? body.correo_electronico.trim().toLowerCase()
        : '';
    const estado = typeof body.estado_propuesto === 'string'
        ? body.estado_propuesto.trim().toUpperCase()
        : '';
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
    const evidencias = Array.isArray(body.evidencias)
        ? body.evidencias.filter((evidencia) => evidencia && typeof evidencia.contenido === 'string')
        : [];

    if (!idEscenario || nombre.length < 1 || nombre.length > 150
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 254
        || !ESTADOS.has(estado) || !descripcion
        || Buffer.byteLength(descripcion, 'utf8') > 65535
        || evidencias.length < 1 || evidencias.length > 5
        || evidencias.some((evidencia) => !/^[A-Za-z0-9+/]+={0,2}$/.test(evidencia.contenido)
            || evidencia.contenido.length > 7_000_000)) {
        return null;
    }

    return {
        id_escenario: idEscenario,
        nombre_completo: nombre,
        correo_electronico: correo,
        estado_propuesto: estado,
        descripcion,
        evidencias
    };

};

const validarSolicitudEscenario = (body = {}) => {
    const idDisciplina = validarId(body.id_disciplina);
    const nombre = typeof body.nombre_escenario === 'string' ? body.nombre_escenario.trim() : '';
    const tipoEscenario = typeof body.tipo_escenario === 'string' ? body.tipo_escenario.trim().toUpperCase() : '';
    const zona = typeof body.zona === 'string' ? body.zona.trim().toUpperCase() : '';
    const tipoUbicacion = typeof body.tipo_ubicacion === 'string' ? body.tipo_ubicacion.trim().toUpperCase() : '';
    const tipoLocalidad = typeof body.tipo_localidad === 'string' ? body.tipo_localidad.trim().toUpperCase() : '';
    const coordenada = valor => typeof valor === 'number' || (typeof valor === 'string' && valor.trim())
        ? Number(valor) : null;
    const latitud = coordenada(body.latitud);
    const longitud = coordenada(body.longitud);
    const urbana = zona === 'URBANA';
    const rural = zona === 'RURAL';
    const tieneGps = tipoUbicacion === 'GPS' && Number.isFinite(latitud) && Number.isFinite(longitud)
        && latitud >= -90 && latitud <= 90 && longitud >= -180 && longitud <= 180;
    const manual = tipoUbicacion === 'MANUAL' && body.latitud == null && body.longitud == null;
    const territorio = Object.fromEntries(['comuna', 'barrio', 'corregimiento', 'localidad_rural'].map(campo =>
        [campo, typeof body[campo] === 'string' ? body[campo].trim() || null : null]
    ));
    const { comuna, barrio, corregimiento, localidad_rural } = territorio;
    const gpsSinTerritorio = tieneGps && !zona && !comuna && !barrio && !corregimiento && !localidad_rural;
    const territorioUrbano = urbana && comuna && barrio && !corregimiento && !localidad_rural && tipoLocalidad === 'BARRIO';
    const territorioRural = rural && corregimiento && localidad_rural && !comuna && !barrio
        && ['VEREDA', 'CENTRO_POBLADO', 'PENDIENTE_VERIFICACION'].includes(tipoLocalidad);

    if (!idDisciplina || !nombre || nombre.length > 150 || !TIPOS_ESCENARIO.has(tipoEscenario)
        || (!tieneGps && !manual) || (!gpsSinTerritorio && !territorioUrbano && !territorioRural)) return null;

    return {
        id_disciplina: idDisciplina,
        nombre_escenario: nombre,
        tipo_escenario: tipoEscenario,
        zona: zona || null,
        ...territorio,
        tipo_localidad: gpsSinTerritorio ? 'PENDIENTE_VERIFICACION' : tipoLocalidad,
        tipo_ubicacion: tipoUbicacion,
        latitud: tieneGps ? latitud : null,
        longitud: tieneGps ? longitud : null
    };
};

const crearReporteVeeduria = async (req, res) => {
    const datos = validarReportePublico(req.body);
    if (!datos) {
        return res.status(400).json({
            success: false,
            message: 'Indica nombre completo, correo válido, escenario, estado y descripción.'
        });
    }

    try {
        const result = await service.crearReporte(datos);
        return res.status(201).json({
            success: true,
            message: 'Reporte recibido y pendiente de revisión por el CMJ.',
            ...result
        });
    } catch (error) {
        return responderError(res, error, 'crear');
    }
};

const crearSolicitudEscenario = async (req, res) => {
    const datos = validarSolicitudEscenario(req.body);
    if (!datos) {
        return res.status(400).json({ success: false, message: 'Los datos territoriales o de ubicación no son válidos.' });
    }
    try {
        const data = await service.crearSolicitudEscenario(datos);
        return res.status(201).json({ success: true, message: 'Propuesta enviada para revisión del CMJ.', data });
    } catch (error) {
        return responderError(res, error, 'crear propuesta de escenario');
    }
};

const obtenerSolicitudesEscenarioPendientes = async (req, res) => {
    try {
        const data = await service.obtenerSolicitudesEscenarioPendientes();
        return res.json({ success: true, data });
    } catch (error) {
        return responderError(res, error, 'consultar propuestas de escenario');
    }
};

const resolverSolicitudEscenario = async (req, res) => {
    const idSolicitud = validarId(req.params.id_solicitud);
    const estado = typeof req.body?.estado_revision === 'string'
        ? req.body.estado_revision.trim().toUpperCase()
        : '';
    const observacion = typeof req.body?.observacion_cmj === 'string'
        ? req.body.observacion_cmj.trim()
        : '';
    if (!idSolicitud || !['APROBADA', 'RECHAZADA'].includes(estado)
        || (estado === 'RECHAZADA' && !observacion)) {
        return res.status(400).json({ success: false, message: 'Indica una decisión válida; el rechazo requiere observación.' });
    }
    try {
        const data = await service.resolverSolicitudEscenario({
            idSolicitud, estado, observacion: observacion || null, idCmj: req.usuario.id_persona
        });
        return res.json({ success: true, message: 'Propuesta resuelta.', data });
    } catch (error) {
        return responderError(res, error, 'resolver propuesta de escenario');
    }
};

const obtenerReportesPendientes = async (req, res) => {
    try {
        const data = await service.obtenerPendientes();
        return res.json({ success: true, data });
    } catch (error) {
        return responderError(res, error, 'consultar pendientes');
    }
};

const obtenerReportesPendientesOficializacion = async (req, res) => {
    try {
        const data = await service.obtenerPendientesOficializacion();
        return res.json({ success: true, data });
    } catch (error) {
        return responderError(res, error, 'consultar pendientes de oficialización');
    }
};

const obtenerDetalleReporte = async (req, res) => {
    const idReporte = validarId(req.params.id_reporte);
    if (!idReporte) return res.status(400).json({ success: false, message: 'Identificador de reporte inválido.' });

    try {
        const data = await service.obtenerDetalle(idReporte);
        return res.json({ success: true, data });
    } catch (error) {
        return responderError(res, error, 'consultar detalle');
    }
};

const obtenerHistorialEscenario = async (req, res) => {
    const idEscenario = validarId(req.params.id_escenario);
    if (!idEscenario) return res.status(400).json({ success: false, message: 'Identificador de escenario inválido.' });

    try {
        const data = await service.obtenerHistorialEscenario(idEscenario);
        return res.json({ success: true, data });
    } catch (error) {
        return responderError(res, error, 'consultar historial');
    }
};

const obtenerSeguimiento = async (req, res) => {
    const codigo = typeof req.params.codigo === 'string' ? req.params.codigo.trim().toLowerCase() : '';
    if (!/^[a-f0-9]{64}$/.test(codigo)) {
        return res.status(400).json({ success: false, message: 'Código de seguimiento inválido.' });
    }

    try {
        const data = await service.obtenerSeguimiento(codigo);
        return res.json({ success: true, data });
    } catch (error) {
        return responderError(res, error, 'consultar seguimiento');
    }
};

const obtenerEvidencia = async (req, res) => {
    const idReporte = validarId(req.params.id_reporte);
    const orden = validarId(req.params.orden);
    if (!idReporte || !orden || orden > 5) {
        return res.status(400).json({ success: false, message: 'Identificador de evidencia inválido.' });
    }

    try {
        const evidencia = await service.obtenerEvidencia(idReporte, orden);
        return res.type(evidencia.mime).sendFile(evidencia.ruta, (error) => {
            if (error && !res.headersSent) {
                responderError(res, error, 'recuperar evidencia');
            }
        });
    } catch (error) {
        return responderError(res, error, 'consultar evidencia');
    }
};

const validarReporteVeeduria = async (req, res) => {
    const idReporte = validarId(req.params.id_reporte);
    const estado = typeof req.body?.estado_reporte === 'string'
        ? req.body.estado_reporte.trim().toUpperCase()
        : '';
    const observacion = typeof req.body?.observacion_cmj === 'string'
        ? req.body.observacion_cmj.trim()
        : '';

    if (!idReporte || !['VALIDADO', 'RECHAZADO'].includes(estado)
        || (estado === 'RECHAZADO' && !observacion)
        || Buffer.byteLength(observacion, 'utf8') > 65535) {
        return res.status(400).json({
            success: false,
            message: 'Indica un reporte válido y un estado VALIDADO o RECHAZADO; el rechazo requiere observación.'
        });
    }

    try {
        const data = await service.validarReporte({
            idReporte,
            estado,
            observacion: observacion || null,
            idCmj: req.usuario.id_persona
        });
        return res.json({ success: true, message: 'Validación registrada.', data });
    } catch (error) {
        return responderError(res, error, 'validar');
    }
};

const oficializarReporteVeeduria = async (req, res) => {
    const idReporte = validarId(req.params.id_reporte);
    if (!idReporte || (req.body && Object.keys(req.body).length > 0)) {
        return res.status(400).json({
            success: false,
            message: 'Identificador inválido. La oficialización aplica el estado propuesto y no acepta otro estado.'
        });
    }

    try {
        const data = await service.oficializarReporte({
            idReporte,
            idCmj: req.usuario.id_persona
        });
        return res.json({ success: true, message: 'Semáforo oficial actualizado.', data });
    } catch (error) {
        return responderError(res, error, 'oficializar');
    }
};

module.exports = {
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
    oficializarReporteVeeduria,
    validarReportePublico,
    validarSolicitudEscenario
};
