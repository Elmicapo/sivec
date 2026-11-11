const test = require('node:test');
const assert = require('node:assert/strict');
const { crearReportesController } = require('./reportes.controller');

const response = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

const database = (availableViews) => {
    const calls = [];
    return {
        calls,
        async query(sql, values = []) {
            calls.push({ sql, values });
            if (sql.includes('information_schema.TABLES')) {
                return [[...availableViews].map((name) => ({ name, type: 'VIEW' }))];
            }
            return [[{ resultado: 'ok' }]];
        }
    };
};

test('report endpoint validates its view before querying report data', async () => {
    const db = database(['v_rep_entrenadores']);
    const controller = crearReportesController({ database: db });
    const res = response();

    await controller.reporteEntrenadores({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, [{ resultado: 'ok' }]);
    assert.equal(db.calls.filter(({ sql }) => sql.includes('SELECT * FROM v_rep_entrenadores')).length, 1);
});

test('missing report view returns 503 and does not execute the functional query', async () => {
    const db = database([]);
    const controller = crearReportesController({ database: db });
    const res = response();

    await controller.reporteDisciplinasDemanda({}, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'SCHEMA_NOT_READY');
    assert.equal(db.calls.some(({ sql }) => sql.includes('SELECT * FROM v_disciplinas_demanda')), false);
});

test('each report endpoint checks only its own view', async () => {
    const db = database(['v_rep_entrenadores']);
    const controller = crearReportesController({ database: db });
    const res = response();

    await controller.reporteEntrenadores({}, res);

    const schemaQuery = db.calls.find(({ sql }) => sql.includes('information_schema.TABLES'));
    assert.deepEqual(schemaQuery.values, ['v_rep_entrenadores']);
});

test('all report endpoints preserve their successful response shape', async () => {
    const cases = [
        ['reporteEntrenadores', 'v_rep_entrenadores'],
        ['reporteDeportistasPorDisciplina', 'v_rep_deportistas_por_disciplina'],
        ['reporteDisciplinasDemanda', 'v_disciplinas_demanda'],
        ['historicoVeedurias', 'v_historico_veedurias']
    ];

    for (const [handler, view] of cases) {
        const db = database([view]);
        const controller = crearReportesController({ database: db });
        const res = response();

        await controller[handler]({}, res);

        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { success: true, data: [{ resultado: 'ok' }] });
    }
});

test('multiple required views reject when one is unavailable', async () => {
    const db = database(['v_rep_entrenadores']);
    const schemaAvailability = require('../utils/schemaAvailability');

    await assert.rejects(
        schemaAvailability.assertSchemaObjectsAvailable(db, [
            { name: 'v_rep_entrenadores', type: 'VIEW' },
            { name: 'v_disciplinas_demanda', type: 'VIEW' }
        ]),
        (error) => error.code === 'SCHEMA_NOT_READY' && error.statusCode === 503
    );
});
