const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('./004_public_registration_and_trainer_requests');

class FakeConnection {
    constructor({ duplicateEmails = 0, duplicateIdentifiers = 0 } = {}) {
        this.duplicateEmails = duplicateEmails;
        this.duplicateIdentifiers = duplicateIdentifiers;
        this.queries = [];
    }

    async query(sql) {
        this.queries.push(sql);
        if (sql.includes('SELECT DATABASE()')) return [[{ database_name: 'sivec_migration_test_auth', mysql_version: '8.0.45' }]];
        if (sql.includes('AS request_engine')) return [[{
            request_engine: 'InnoDB',
            email_unique_index: 1,
            identification_unique_index: 1,
            foreign_keys: 3,
            resolution_check: 1
        }]];
        if (sql.includes('SELECT ENGINE FROM information_schema.TABLES')) return [[{ ENGINE: 'InnoDB' }]];
        if (sql.includes('FROM information_schema.STATISTICS')
            && sql.includes("TABLE_NAME = 'persona'")) return [[]];
        if (sql.includes('AS id_groups_found')) {
            return [[{ id_groups_found: this.duplicateIdentifiers }]];
        }
        if (sql.includes('AS groups_found')) return [[{ groups_found: this.duplicateEmails }]];
        if (sql.includes("TABLE_NAME = 'solicitud_vinculacion_entrenador'")) return [[]];
        return [{ affectedRows: 1 }];
    }
}

test('migration adds unique email and pending trainer request schema after duplicate preflight', async () => {
    const connection = new FakeConnection();
    await migration.up(connection);

    assert.ok(connection.queries.some((sql) =>
        sql.includes('ALTER TABLE persona ADD UNIQUE INDEX uq_persona_correo_electronico')));
    assert.ok(connection.queries.some((sql) =>
        sql.includes('ALTER TABLE persona ADD UNIQUE INDEX uq_persona_numero_identificacion')));
    const createTable = connection.queries.find((sql) =>
        sql.includes('CREATE TABLE solicitud_vinculacion_entrenador'));
    assert.ok(createTable);
    assert.match(createTable, /estado ENUM\('PENDIENTE', 'APROBADA', 'RECHAZADA'\)/);
    assert.match(createTable, /fk_solicitud_vinculacion_administrativo/);
    assert.match(createTable, /ck_solicitud_vinculacion_resolucion/);
    assert.equal(connection.queries.some((sql) => /^\s*(DROP|DELETE|TRUNCATE)\b/i.test(sql)), false);
});

test('migration refuses to add a unique email index when duplicates already exist', async () => {
    const connection = new FakeConnection({ duplicateEmails: 1 });
    await assert.rejects(migration.up(connection), /Duplicate emails prevent/);
    assert.equal(connection.queries.some((sql) => sql.includes('ALTER TABLE persona')), false);
    assert.equal(connection.queries.some((sql) => sql.includes('CREATE TABLE solicitud_vinculacion_entrenador')), false);
});

test('migration refuses to add a unique identification index when duplicates already exist', async () => {
    const connection = new FakeConnection({ duplicateIdentifiers: 1 });
    await assert.rejects(migration.up(connection), /Duplicate identification numbers prevent/);
    assert.equal(connection.queries.some((sql) => sql.includes('ALTER TABLE persona')), false);
    assert.equal(connection.queries.some((sql) => sql.includes('CREATE TABLE solicitud_vinculacion_entrenador')), false);
});
