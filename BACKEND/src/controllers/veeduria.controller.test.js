const test = require('node:test');
const assert = require('node:assert/strict');
const {
    validarReportePublico,
    validarReporteVeeduria,
    oficializarReporteVeeduria
} = require('./veeduria.controller');
const { permitirRoles } = require('../middlewares/authMiddleware');

const createResponse = () => ({
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
});

test('public report requires a complete name, email, scenario, state, and description', () => {
    assert.equal(validarReportePublico({
        id_escenario: 1,
        nombre_completo: '  Nombre Completo  ',
        correo_electronico: ' PERSONA@EXAMPLE.ORG ',
        estado_propuesto: 'verde',
        descripcion: '  Daño visible  ',
        numero_identificacion: 'ignored',
        evidencias: [{ contenido: 'aGVsbG8=' }]
    })?.nombre_completo, 'Nombre Completo');
    assert.equal(validarReportePublico({ nombre_completo: 'Nombre' }), null);
    assert.equal(validarReportePublico({
        id_escenario: 1,
        nombre_completo: 'Nombre',
        correo_electronico: 'persona@example.org',
        estado_propuesto: 'VERDE',
        descripcion: 'Daño'
    }), null);
    assert.equal(validarReportePublico({
        id_escenario: 1,
        nombre_completo: 'Nombre',
        correo_electronico: 'invalido',
        estado_propuesto: 'VERDE',
        descripcion: 'Daño'
    }), null);
});

test('administrative middleware permits CMJ and denies other roles', () => {
    const middleware = permitirRoles('CMJ');
    const allowed = { statusCode: null, status(code) { this.statusCode = code; return this; }, json() {} };
    let nextCalled = false;

    middleware({ usuario: { rol: 'CMJ' } }, allowed, () => { nextCalled = true; });
    assert.equal(nextCalled, true);

    const denied = { statusCode: null, status(code) { this.statusCode = code; return this; }, json() {} };
    middleware({ usuario: { rol: 'DEPORTISTA' } }, denied, () => assert.fail('Unexpected authorization.'));
    assert.equal(denied.statusCode, 403);
});

test('rejecting without an observation is rejected before any database operation', async () => {
    const response = createResponse();
    await validarReporteVeeduria({
        params: { id_reporte: '1' },
        body: { estado_reporte: 'RECHAZADO' },
        usuario: { id_persona: 9 }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /observación/);
});

test('officialization does not accept a client-selected semáforo state', async () => {
    const response = createResponse();
    await oficializarReporteVeeduria({
        params: { id_reporte: '1' },
        body: { estado_propuesto: 'VERDE' },
        usuario: { id_persona: 9 }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /no acepta otro estado/);
});

test('public report rejects more than five evidences', () => {
    const evidencias = Array.from({ length: 6 }, () => ({ contenido: 'aGVsbG8=' }));
    assert.equal(validarReportePublico({
        id_escenario: 1,
        nombre_completo: 'Nombre',
        correo_electronico: 'persona@example.org',
        estado_propuesto: 'VERDE',
        descripcion: 'Daño',
        evidencias
    }), null);
});
