const test = require('node:test')
const assert = require('node:assert/strict')
const { createVinculacionHandlers } = require('./entrenadores.controller')
const router = require('../routes/entrenadores.routes')

class FakeConnection {
    constructor(request = { id_entrenador: 12, id_disciplina: 7, estado: 'PENDIENTE' }) {
        this.request = request
        this.queries = []
        this.committed = false
        this.rolledBack = false
        this.released = false
    }

    async beginTransaction() {
        this.queries.push({ sql: 'BEGIN' })
    }

    async query(sql, values = []) {
        this.queries.push({ sql, values })
        if (sql.includes('information_schema.TABLES')) {
            return [[...values].map((name) => ({ name, type: 'BASE TABLE' }))]
        }
        if (sql.includes('FOR UPDATE')) return [[this.request].filter(Boolean)]
        return [{ affectedRows: 1 }]
    }

    async commit() {
        this.committed = true
    }

    async rollback() {
        this.rolledBack = true
    }

    release() {
        this.released = true
    }
}

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code
            return this
        },
        json(body) {
            this.body = body
            return this
        }
    }
}

function createHandler(connection) {
    let connections = 0
    const handlers = createVinculacionHandlers({
        getConnection: async () => {
            connections += 1
            return connection
        }
    })
    return { ...handlers, connection, getConnections: () => connections }
}

test('trainer linkage approval creates the association and resolves the request atomically', async () => {
    const connection = new FakeConnection()
    const { resolverSolicitudVinculacion } = createHandler(connection)
    const response = createResponse()

    await resolverSolicitudVinculacion({
        params: { id: '5' },
        body: { estado: 'APROBADA' },
        usuario: { id_persona: 3 }
    }, response)

    const insertIndex = connection.queries.findIndex(({ sql }) => sql.includes('INSERT INTO disciplina_entrenador'))
    const updateIndex = connection.queries.findIndex(({ sql }) => sql.includes('UPDATE solicitud_vinculacion_entrenador'))
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body, { success: true, message: 'Vinculación aprobada' })
    assert.ok(insertIndex > 0 && updateIndex > insertIndex)
    assert.deepEqual(connection.queries[insertIndex].values, [7, 12])
    assert.deepEqual(connection.queries[updateIndex].values, ['APROBADA', 3, 5])
    assert.equal(connection.committed, true)
    assert.equal(connection.rolledBack, false)
    assert.equal(connection.released, true)
})

test('trainer linkage rejection records the decision without creating an association', async () => {
    const connection = new FakeConnection()
    const { resolverSolicitudVinculacion } = createHandler(connection)
    const response = createResponse()

    await resolverSolicitudVinculacion({
        params: { id: '5' },
        body: { estado: 'RECHAZADA' },
        usuario: { id_persona: 3 }
    }, response)

    assert.equal(response.statusCode, 200)
    assert.equal(connection.queries.some(({ sql }) => sql.includes('INSERT INTO disciplina_entrenador')), false)
    assert.deepEqual(
        connection.queries.find(({ sql }) => sql.includes('UPDATE solicitud_vinculacion_entrenador')).values,
        ['RECHAZADA', 3, 5]
    )
    assert.equal(connection.committed, true)
})

test('resolved trainer linkage requests cannot be resolved twice', async () => {
    const connection = new FakeConnection({
        id_entrenador: 12,
        id_disciplina: 7,
        estado: 'APROBADA'
    })
    const { resolverSolicitudVinculacion } = createHandler(connection)
    const response = createResponse()

    await resolverSolicitudVinculacion({
        params: { id: '5' },
        body: { estado: 'RECHAZADA' },
        usuario: { id_persona: 3 }
    }, response)

    assert.equal(response.statusCode, 409)
    assert.equal(connection.rolledBack, true)
    assert.equal(connection.committed, false)
    assert.equal(connection.queries.some(({ sql }) => sql.includes('UPDATE ')), false)
})

test('invalid trainer linkage decisions are rejected before opening a transaction', async () => {
    const connection = new FakeConnection()
    const { resolverSolicitudVinculacion, getConnections } = createHandler(connection)
    const response = createResponse()

    await resolverSolicitudVinculacion({
        params: { id: '0' },
        body: { estado: 'PENDIENTE' },
        usuario: { id_persona: 3 }
    }, response)

    assert.equal(response.statusCode, 400)
    assert.equal(getConnections(), 0)
})

test('trainer linkage resolution route is restricted to administrative users', () => {
    const route = router.stack.find((layer) =>
        layer.route?.path === '/solicitudes-vinculacion/:id/resolver' && layer.route.methods.post
    )
    assert.ok(route)
    const requireAdministrativeRole = route.route.stack[1].handle

    let nextCalled = false
    const denied = createResponse()
    requireAdministrativeRole({ usuario: { rol: 'ENTRENADOR' } }, denied, () => { nextCalled = true })
    assert.equal(denied.statusCode, 403)
    assert.equal(nextCalled, false)

    const allowed = createResponse()
    requireAdministrativeRole({ usuario: { rol: 'ADMINISTRATIVO' } }, allowed, () => { nextCalled = true })
    assert.equal(nextCalled, true)
})
