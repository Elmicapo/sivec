const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createVeeduriaService, VeeduriaError } = require('./veeduria.service');

const fixedDate = '2026-11-04 13:00:00';

class FakeConnection {
    constructor(options = {}) {
        this.options = options;
        this.queries = [];
        this.committed = false;
        this.rolledBack = false;
        this.released = false;
    }

    async beginTransaction() {}

    async commit() {
        this.committed = true;
    }

    async rollback() {
        this.rolledBack = true;
    }

    release() {
        this.released = true;
    }

    async query(sql, values = []) {
        this.queries.push({ sql, values });
        if (sql.includes('FROM sivec_schema_migrations')) {
            if (values.includes('005')) {
                return [[{ version: '001' }, { version: '002' }, { version: '005' }]];
            }
            return [[{ version: '001' }, { version: '002' }, { version: '003' }]];
        }
        if (sql.includes('SELECT id_disciplina FROM disciplina')) {
            return [[{ id_disciplina: values[0] }]];
        }
        if (sql.includes('FROM reporte_veeduria r')) return [[]];
        if (sql.includes('FROM escenario WHERE id_escenario = ? FOR UPDATE')) {
            return [this.options.scenarioExists === false ? [] : [{ id_escenario: values[0], estado_semaforo: this.options.scenarioState || 'VERDE' }]];
        }
        if (sql.includes('SELECT UTC_TIMESTAMP()')) return [[{ fecha_utc: fixedDate }]];
        if (sql.includes('INSERT INTO reporte_veeduria\n')) return [{ insertId: 41, affectedRows: 1 }];
        if (sql.includes('FROM cmj_consejero WHERE id_persona = ?')) {
            return [this.options.cmjExists === false ? [] : [{ id_persona: values[0] }]];
        }
        if (sql.includes('FROM reporte_veeduria') && sql.includes('FOR UPDATE')) {
            return [this.options.report ? [this.options.report] : [{
                id_reporte: values[0],
                id_escenario: 7,
                estado_propuesto: 'ROJO',
                estado_reporte: 'PENDIENTE',
                id_cmj_valida: null,
                fecha_validacion: null,
                id_cmj_oficializa: null,
                fecha_oficializacion: null
            }]];
        }
        if (sql.includes('FROM historial_estado_escenario WHERE id_reporte')) {
            return [this.options.legacyHistory ? [{ id_historial: 3 }] : []];
        }
        if (sql.includes('FROM escenario') && sql.includes('FOR UPDATE')) {
            return [this.options.scenarioExists === false
                ? []
                : [{ id_escenario: 7, estado_semaforo: this.options.scenarioState || 'VERDE' }]];
        }
        if (sql.startsWith('UPDATE')) return [{ affectedRows: 1 }];
        return [{ affectedRows: 1 }];
    }
}

const createHarness = (options = {}) => {
    const connection = new FakeConnection(options);
    const pool = {
        getConnection: async () => connection,
        query: async (sql, values) => connection.query(sql, values)
    };
    return { connection, service: createVeeduriaService(pool) };
};

test('public report requires no account or identity number and stores a hashed tracking code', async () => {
    const { connection, service } = createHarness();
    const result = await service.crearReporte({
        id_escenario: 7,
        nombre_completo: 'Ciudadana Ejemplo',
        correo_electronico: 'ciudadana@example.org',
        estado_propuesto: 'AMARILLO',
        descripcion: 'Requiere mantenimiento'
    });

    assert.equal(result.id_reporte, 41);
    assert.match(result.codigo_seguimiento, /^[a-f0-9]{64}$/);
    assert.equal(connection.committed, true);
    assert.equal(connection.rolledBack, false);
    assert.equal(connection.released, true);
    assert.ok(connection.queries.some(({ sql, values }) =>
        sql.includes('INSERT INTO solicitud_veeduria')
        && values[0].equals(crypto.createHash('sha256').update(result.codigo_seguimiento).digest())));
    assert.ok(connection.queries.some(({ sql }) => sql.includes("VALUES (?, NULL, ?, ?, 'PENDIENTE', ?)")));
    assert.equal(connection.queries.some(({ sql }) => /numero_identificacion|persona\s*\(/i.test(sql)), false);
});

test('report creation rolls back if the selected scenario does not exist', async () => {
    const { connection, service } = createHarness({ scenarioExists: false });

    await assert.rejects(
        service.crearReporte({
            id_escenario: 999,
            nombre_completo: 'Ciudadana Ejemplo',
            correo_electronico: 'ciudadana@example.org',
            estado_propuesto: 'VERDE',
            descripcion: 'Descripción'
        }),
        (error) => error instanceof VeeduriaError && error.statusCode === 404
    );
    assert.equal(connection.rolledBack, true);
    assert.equal(connection.committed, false);
});

test('writes fail closed when the required migrations are not applied', async () => {
    const connection = new FakeConnection();
    connection.query = async (sql, values = []) => {
        connection.queries.push({ sql, values });
        if (sql.includes('FROM sivec_schema_migrations')) return [[{ version: '001' }, { version: '002' }]];
        return [{ affectedRows: 1 }];
    };
    const service = createVeeduriaService({ getConnection: async () => connection });

    await assert.rejects(
        service.crearReporte({
            id_escenario: 7,
            nombre_completo: 'Ciudadana Ejemplo',
            correo_electronico: 'ciudadana@example.org',
            estado_propuesto: 'VERDE',
            descripcion: 'Descripción'
        }),
        (error) => error instanceof VeeduriaError && error.statusCode === 503
    );
    assert.equal(connection.rolledBack, true);
    assert.equal(connection.queries.some(({ sql }) => sql.includes('INSERT INTO reporte_veeduria\n')), false);
});

test('scenario requests fail closed when migration 005 is missing', async () => {
    const connection = new FakeConnection();
    connection.query = async (sql, values = []) => {
        connection.queries.push({ sql, values });
        if (sql.includes('FROM sivec_schema_migrations')) {
            return values.includes('005')
                ? [[{ version: '001' }, { version: '002' }]]
                : [[{ version: '001' }, { version: '002' }, { version: '003' }]];
        }
        return [{ affectedRows: 1 }];
    };
    const service = createVeeduriaService({ getConnection: async () => connection });

    await assert.rejects(
        service.crearSolicitudEscenario({
            nombre_escenario: 'Solicitud sin migración 005',
            tipo_escenario: 'CANCHA',
            id_disciplina: 1,
            zona: 'URBANA',
            comuna: 'Comuna 1',
            barrio: 'La Paz',
            corregimiento: null,
            localidad_rural: null,
            tipo_localidad: 'BARRIO',
            tipo_ubicacion: 'MANUAL',
            latitud: null,
            longitud: null
        }),
        (error) => error instanceof VeeduriaError
            && error.code === 'VEEDURIA_SCHEMA_NOT_READY'
            && error.statusCode === 503
    );
    assert.equal(connection.queries.some(({ sql }) => sql.includes('INSERT INTO solicitud_escenario')), false);
});

test('scenario requests proceed when migrations 001, 002, and 005 are applied', async () => {
    const { connection, service } = createHarness();
    const result = await service.crearSolicitudEscenario({
        nombre_escenario: 'Solicitud con migración 005',
        tipo_escenario: 'CANCHA',
        id_disciplina: 1,
        zona: 'URBANA',
        comuna: 'Comuna 1',
        barrio: 'La Paz',
        corregimiento: null,
        localidad_rural: null,
        tipo_localidad: 'BARRIO',
        tipo_ubicacion: 'MANUAL',
        latitud: null,
        longitud: null
    });

    assert.equal(result.estado_revision, 'PENDIENTE');
    assert.equal(connection.committed, true);
    assert.ok(connection.queries.some(({ sql, values }) =>
        sql.includes('INSERT INTO solicitud_escenario')
        && values.includes('CANCHA')));
});

test('CMJ validation records a decision but never updates the scenario semáforo', async () => {
    const { connection, service } = createHarness();
    const result = await service.validarReporte({
        idReporte: 41,
        estado: 'VALIDADO',
        observacion: null,
        idCmj: 9
    });

    assert.equal(result.estado_reporte, 'VALIDADO');
    assert.equal(connection.committed, true);
    assert.ok(connection.queries.some(({ sql }) => sql.includes('INSERT INTO reporte_veeduria_historial')));
    assert.equal(connection.queries.some(({ sql }) => sql.startsWith('UPDATE escenario')), false);
    assert.equal(connection.queries.some(({ sql }) => sql.includes('INSERT INTO historial_estado_escenario')), false);
});

test('non-CMJ identity cannot validate a report', async () => {
    const { connection, service } = createHarness({ cmjExists: false });

    await assert.rejects(
        service.validarReporte({ idReporte: 41, estado: 'VALIDADO', observacion: null, idCmj: 10 }),
        (error) => error instanceof VeeduriaError && error.statusCode === 403
    );
    assert.equal(connection.rolledBack, true);
    assert.equal(connection.queries.some(({ sql }) => sql.startsWith('UPDATE')), false);
});

test('a rejected or pending report cannot be officially applied', async () => {
    const { connection, service } = createHarness({
        report: {
            id_reporte: 41,
            id_escenario: 7,
            estado_propuesto: 'ROJO',
            estado_reporte: 'PENDIENTE',
            id_cmj_valida: null,
            fecha_validacion: null,
            id_cmj_oficializa: null,
            fecha_oficializacion: null
        }
    });

    await assert.rejects(
        service.oficializarReporte({ idReporte: 41, idCmj: 9 }),
        (error) => error instanceof VeeduriaError && error.code === 'REPORT_NOT_VALIDATED'
    );
    assert.equal(connection.rolledBack, true);
    assert.equal(connection.queries.some(({ sql }) => sql.startsWith('UPDATE escenario')), false);
});

test('separate D1 officialization records history even when the color is unchanged', async () => {
    const { connection, service } = createHarness({
        scenarioState: 'ROJO',
        report: {
            id_reporte: 41,
            id_escenario: 7,
            estado_propuesto: 'ROJO',
            estado_reporte: 'VALIDADO',
            id_cmj_valida: 8,
            fecha_validacion: '2026-11-04 12:00:00',
            id_cmj_oficializa: null,
            fecha_oficializacion: null
        }
    });

    const result = await service.oficializarReporte({ idReporte: 41, idCmj: 9 });
    const scenarioUpdate = connection.queries.find(({ sql }) => sql.startsWith('UPDATE escenario'));
    const historyInsert = connection.queries.find(({ sql }) => sql.includes('INSERT INTO historial_estado_escenario'));

    assert.equal(result.estado_sin_cambio, true);
    assert.deepEqual(scenarioUpdate.values, ['ROJO', fixedDate, 7]);
    assert.deepEqual(historyInsert.values, [7, 41, 'ROJO', 'ROJO', 9, fixedDate]);
    assert.equal(connection.committed, true);
});

test('legacy officialization history blocks a second D1 history entry', async () => {
    const { connection, service } = createHarness({
        legacyHistory: true,
        report: {
            id_reporte: 41,
            id_escenario: 7,
            estado_propuesto: 'ROJO',
            estado_reporte: 'VALIDADO',
            id_cmj_valida: 8,
            fecha_validacion: '2026-11-04 12:00:00',
            id_cmj_oficializa: null,
            fecha_oficializacion: null
        }
    });

    await assert.rejects(
        service.oficializarReporte({ idReporte: 41, idCmj: 9 }),
        (error) => error instanceof VeeduriaError && error.code === 'LEGACY_HISTORY_EXISTS'
    );
    assert.equal(connection.rolledBack, true);
    assert.equal(connection.queries.some(({ sql }) => sql.startsWith('UPDATE escenario')), false);
});

test('a report already marked as officially applied cannot be applied twice', async () => {
    const { connection, service } = createHarness({
        report: {
            id_reporte: 41,
            id_escenario: 7,
            estado_propuesto: 'ROJO',
            estado_reporte: 'VALIDADO',
            id_cmj_valida: 8,
            fecha_validacion: '2026-11-04 12:00:00',
            id_cmj_oficializa: 9,
            fecha_oficializacion: '2026-11-04 12:30:00'
        }
    });

    await assert.rejects(
        service.oficializarReporte({ idReporte: 41, idCmj: 9 }),
        (error) => error instanceof VeeduriaError && error.code === 'ALREADY_OFFICIALIZED'
    );
    assert.equal(connection.rolledBack, true);
    assert.equal(connection.queries.some(({ sql }) => sql.startsWith('UPDATE escenario')), false);
});

test('CMJ pending queue query does not select citizen contact details', async () => {
    const { connection, service } = createHarness();
    await service.obtenerPendientes();
    const query = connection.queries.find(({ sql }) => sql.includes('FROM reporte_veeduria r')).sql;
    assert.match(query, /estado_reporte = 'PENDIENTE'/);
    assert.doesNotMatch(query, /correo_contacto|nombre_contacto|numero_identificacion/i);
});

test('D1 officialization queue only selects validated, unmarked reports without legacy history', async () => {
    const { connection, service } = createHarness();
    await service.obtenerPendientesOficializacion();
    const query = connection.queries.find(({ sql }) => sql.includes('estado_actual')).sql;
    assert.match(query, /estado_reporte = 'VALIDADO'/);
    assert.match(query, /id_cmj_oficializa IS NULL AND r\.fecha_oficializacion IS NULL/);
    assert.match(query, /NOT EXISTS[\s\S]*historial_estado_escenario/);
    assert.doesNotMatch(query, /correo_contacto|nombre_contacto|numero_identificacion/i);
});
