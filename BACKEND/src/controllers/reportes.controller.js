const db = require('../config/db');
const { responderErrorInterno } = require('../utils/safeError');
const { assertSchemaObjectsAvailable, SchemaNotReadyError } = require('../utils/schemaAvailability');

const SCHEMA_ERROR_MESSAGES = {
    entrenadores: 'El reporte de entrenadores aún no está habilitado.',
    deportistas: 'El reporte de deportistas aún no está habilitado.',
    demanda: 'El reporte de demanda aún no está habilitado.',
    historico_veedurias: 'El histórico de veedurías aún no está habilitado.'
};

const crearGuardiaVista = (database, view) => () => assertSchemaObjectsAvailable(
    database,
    [{ name: view, type: 'VIEW' }]
);

const crearReportesController = ({ database = db } = {}) => {
    const vistas = {
        entrenadores: crearGuardiaVista(database, 'v_rep_entrenadores'),
        deportistas: crearGuardiaVista(database, 'v_rep_deportistas_por_disciplina'),
        demanda: crearGuardiaVista(database, 'v_disciplinas_demanda'),
        historico_veedurias: crearGuardiaVista(database, 'v_historico_veedurias')
    };

    const responderErrorEsquema = (res, error, tipo) => {
        if (!(error instanceof SchemaNotReadyError)) return false;
        return res.status(503).json({
            success: false,
            code: error.code,
            message: SCHEMA_ERROR_MESSAGES[tipo]
        });
    };

    // 1. Reporte de Entrenadores Registrados (RF-ADM-01, RF-DEP-02)
    const reporteEntrenadores = async (req, res) => {
        try {
            await vistas.entrenadores();
            const [data] = await database.query('SELECT * FROM v_rep_entrenadores');
            res.json({ success: true, data });
        } catch (error) {
            if (responderErrorEsquema(res, error, 'entrenadores')) return;
            return responderErrorInterno(res, 'reportes.entrenadores', 'Error al obtener reporte de entrenadores')(error);
        }
    };

    // 2. Reporte de Deportistas por Disciplina (RF-ENT-04)
    const reporteDeportistasPorDisciplina = async (req, res) => {
        try {
            await vistas.deportistas();
            const [data] = await database.query('SELECT * FROM v_rep_deportistas_por_disciplina');
            res.json({ success: true, data });
        } catch (error) {
            if (responderErrorEsquema(res, error, 'deportistas')) return;
            return responderErrorInterno(res, 'reportes.deportistas', 'Error al obtener reporte de deportistas')(error);
        }
    };

    // 3. Disciplinas con mayor demanda u ocupación (RF-ADM-04)
    const reporteDisciplinasDemanda = async (req, res) => {
        try {
            await vistas.demanda();
            const [data] = await database.query('SELECT * FROM v_disciplinas_demanda');
            res.json({ success: true, data });
        } catch (error) {
            if (responderErrorEsquema(res, error, 'demanda')) return;
            return responderErrorInterno(res, 'reportes.demanda', 'Error al consultar demanda de disciplinas')(error);
        }
    };

    // 4. Histórico de Veedurías por Escenario (RF-CMJ-04, RF-COM-05)
    const historicoVeedurias = async (req, res) => {
        try {
            await vistas.historico_veedurias();
            const [data] = await database.query('SELECT * FROM v_historico_veedurias');
            res.json({ success: true, data });
        } catch (error) {
            if (responderErrorEsquema(res, error, 'historico_veedurias')) return;
            return responderErrorInterno(res, 'reportes.historico_veedurias', 'Error al consultar histórico de veedurías')(error);
        }
    };

    return { reporteEntrenadores, reporteDeportistasPorDisciplina, reporteDisciplinasDemanda, historicoVeedurias };
};

const {
    reporteEntrenadores,
    reporteDeportistasPorDisciplina,
    reporteDisciplinasDemanda,
    historicoVeedurias
} = crearReportesController();

module.exports = {
    crearReportesController,
    reporteEntrenadores,
    reporteDeportistasPorDisciplina,
    reporteDisciplinasDemanda,
    historicoVeedurias
};