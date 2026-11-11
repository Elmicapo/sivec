const test = require('node:test');
const assert = require('node:assert/strict');
const { crearEscenariosController } = require('./escenarios.controller');

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

const database = (views) => {
    const calls = [];
    return {
        calls,
        async query(sql, values = []) {
            calls.push({ sql, values });
            if (sql.includes('information_schema.TABLES')) {
                return [[...views].map((name) => ({ name, type: 'VIEW' }))];
            }
            return [[{ id_escenario: 1 }]];
        }
    };
};

test('scenario catalog queries its view when available', async () => {
    const db = database(['v_rep_escenarios_semaforo']);
    const { obtenerEscenarios } = crearEscenariosController({ database: db });
    const res = response();

    await obtenerEscenarios({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, [{ id_escenario: 1 }]);
});

test('scenario catalog returns 503 without querying the view when unavailable', async () => {
    const db = database([]);
    const { obtenerEscenarios } = crearEscenariosController({ database: db });
    const res = response();

    await obtenerEscenarios({}, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'SCHEMA_NOT_READY');
    assert.equal(db.calls.some(({ sql }) => sql.includes('SELECT * FROM v_rep_escenarios_semaforo')), false);
});
