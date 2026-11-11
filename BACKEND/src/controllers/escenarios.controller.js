const db = require('../config/db');
const { responderErrorInterno } = require('../utils/safeError');
const { assertSchemaObjectsAvailable, SchemaNotReadyError } = require('../utils/schemaAvailability');

const crearEscenariosController = ({ database = db } = {}) => ({
    obtenerEscenarios: async (req, res) => {
        try {
            await assertSchemaObjectsAvailable(
                database,
                [{ name: 'v_rep_escenarios_semaforo', type: 'VIEW' }]
            );
            const [escenarios] = await database.query('SELECT * FROM v_rep_escenarios_semaforo');
            res.json({ success: true, data: escenarios });
        } catch (error) {
            if (error instanceof SchemaNotReadyError) {
                return res.status(503).json({
                    success: false,
                    code: error.code,
                    message: 'El catálogo de escenarios aún no está habilitado.'
                });
            }
            return responderErrorInterno(res, 'escenarios.listar', 'Error al obtener escenarios')(error);
        }
    }
});

const { obtenerEscenarios } = crearEscenariosController();

module.exports = { obtenerEscenarios, crearEscenariosController };
