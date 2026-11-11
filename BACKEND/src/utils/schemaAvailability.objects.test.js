const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSchemaObjectsAvailable, SchemaNotReadyError } = require('./schemaAvailability');

const connection = (rows) => ({
    queries: [],
    async query(sql, values) {
        this.queries.push({ sql, values });
        return [rows];
    }
});

test('schema object availability accepts the required tables and view', async () => {
    const db = connection([
        { name: 'cronograma', type: 'BASE TABLE' },
        { name: 'v_cronograma_consolidado', type: 'VIEW' }
    ]);

    await assert.doesNotReject(assertSchemaObjectsAvailable(db, [
        'cronograma',
        { name: 'v_cronograma_consolidado', type: 'VIEW' }
    ]));
});

test('schema object availability rejects a missing object', async () => {
    const db = connection([{ name: 'cronograma', type: 'BASE TABLE' }]);

    await assert.rejects(
        assertSchemaObjectsAvailable(db, ['cronograma', 'disciplina']),
        (error) => error instanceof SchemaNotReadyError && error.statusCode === 503
    );
});

test('schema object availability rejects an object with the wrong type', async () => {
    const db = connection([{ name: 'v_cronograma_consolidado', type: 'BASE TABLE' }]);

    await assert.rejects(
        assertSchemaObjectsAvailable(db, [{ name: 'v_cronograma_consolidado', type: 'VIEW' }]),
        (error) => error instanceof SchemaNotReadyError && error.statusCode === 503
    );
});
