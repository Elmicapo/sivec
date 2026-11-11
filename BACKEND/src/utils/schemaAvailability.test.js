const test = require('node:test');
const assert = require('node:assert/strict');
const { assertMigrationsApplied, SchemaNotReadyError } = require('./schemaAvailability');

function fakeConnection({ rows = [], error = null } = {}) {
    const calls = [];
    return {
        calls,
        async query(sql, values) {
            calls.push({ sql, values });
            if (error) throw error;
            return [rows];
        }
    };
}

test('schema availability rejects a missing migration ledger', async () => {
    const connection = fakeConnection({ error: { code: 'ER_NO_SUCH_TABLE' } });

    await assert.rejects(
        assertMigrationsApplied(connection, ['004']),
        (error) => error instanceof SchemaNotReadyError
            && error.statusCode === 503
            && error.code === 'SCHEMA_NOT_READY'
    );
});

test('schema availability rejects a required migration that is absent', async () => {
    const connection = fakeConnection({ rows: [{ version: '001' }] });

    await assert.rejects(
        assertMigrationsApplied(connection, ['001', '002']),
        (error) => error instanceof SchemaNotReadyError && error.statusCode === 503
    );
});

test('schema availability rejects a migration not marked APPLIED', async () => {
    const connection = fakeConnection({ rows: [{ version: '004', status: 'FAILED' }] });

    await assert.rejects(
        assertMigrationsApplied(connection, ['004']),
        SchemaNotReadyError
    );
});

test('schema availability accepts all required applied migrations', async () => {
    const connection = fakeConnection({
        rows: [
            { version: '001', status: 'APPLIED' },
            { version: '002', status: 'APPLIED' },
            { version: '005', status: 'APPLIED' }
        ]
    });

    await assert.doesNotReject(assertMigrationsApplied(connection, ['001', '002', '005']));
    assert.deepEqual(connection.calls[0].values, ['001', '002', '005']);
});
