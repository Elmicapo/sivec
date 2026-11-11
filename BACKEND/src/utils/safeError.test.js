const test = require('node:test');
const assert = require('node:assert/strict');
const { responderErrorInterno } = require('./safeError');

test('responderErrorInterno no expone detalles técnicos al cliente', () => {
    const response = {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };

    responderErrorInterno(
        response,
        'test.database',
        'No fue posible completar la operación.'
    )({
        code: 'ER_NO_SUCH_TABLE',
        sqlState: '42S02',
        message: "Table 'deportes.privada' doesn't exist"
    });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
        success: false,
        message: 'No fue posible completar la operación.'
    });
    assert.equal(JSON.stringify(response.body).includes('privada'), false);
    assert.equal(JSON.stringify(response.body).includes('ER_NO_SUCH_TABLE'), false);
});
