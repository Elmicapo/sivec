const test = require('node:test')
const assert = require('node:assert/strict')
const { createVinculacionHandlers } = require('./entrenadores.controller')
const router = require('../routes/entrenadores.routes')

function response() {
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

class RequestConnection {
    constructor({ pending = false, approved = false, profile = true, discipline = true } = {}) {
        this.pending = pending
        this.approved = approved
        this.profile = profile
        this.discipline = discipline
        this.queries = []
        this.committed = false
        this.rolledBack = false
        this.released = false
    }

    async beginTransaction() {
        this.queries.push({ sql: 'BEGIN', values: [] })
    }

    async query(sql, values = []) {
        this.queries.push({ sql, values })
        if (sql.includes('FROM entrenador')) return [this.profile ? [{ id_persona: 8 }] : []]
        if (sql.includes('FROM disciplina_entrenador')) return [this.approved ? [{ 1: 1 }] : []]
        if (sql.includes('FROM solicitud_vinculacion_entrenador')) {
            return [this.pending ? [{ 1: 1 }] : []]
        }
        if (sql.includes('FROM disciplina')) return [this.discipline ? [{ id_disciplina: 4 }] : []]
        if (sql.includes('INSERT INTO solicitud_vinculacion_entrenador')) {
            return [{ insertId: 20 }]
        }
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

function handler(connection) {
    return createVinculacionHandlers({
        getConnection: async () => connection,
        query: async () => [[
            {
                id_solicitud_vinculacion: 7,
                id_disciplina: 4,
                disciplina: 'Fútbol',
                estado: 'RECHAZADA',
                fecha_solicitud: '2026-11-09 10:00:00',
                fecha_resolucion: '2026-11-09 11:00:00',
                administrador_resuelve: 'Administración'
            }
        ]]
    })
}

test('trainer request history is filtered by authenticated id_persona', async () => {
    const calls = []
    const handlers = createVinculacionHandlers({
        query: async (sql, values) => {
            calls.push({ sql, values })
            return [[{ id_entrenador: 8, estado: 'PENDIENTE' }]]
        }
    })
    const res = response()

    await handlers.listarMisSolicitudesVinculacion({ usuario: { id_persona: 8 } }, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body.data, [{ id_entrenador: 8, estado: 'PENDIENTE' }])
    assert.deepEqual(calls[0].values, [8])
    assert.match(calls[0].sql, /WHERE s\.id_entrenador = \?/)
})

test('trainer can create a pending request for an additional discipline', async () => {
    const connection = new RequestConnection()
    const res = response()

    await handler(connection).solicitarVinculacion({
        usuario: { id_persona: 8, rol: 'ENTRENADOR' },
        body: { id_disciplina: 4 }
    }, res)

    assert.equal(res.statusCode, 201)
    assert.equal(res.body.id_solicitud_vinculacion, 20)
    assert.equal(connection.committed, true)
    assert.deepEqual(connection.queries.at(-1).values, [8, 4])
})

test('pending duplicate requests are rejected', async () => {
    const connection = new RequestConnection({ pending: true })
    const res = response()

    await handler(connection).solicitarVinculacion({
        usuario: { id_persona: 8, rol: 'ENTRENADOR' },
        body: { id_disciplina: 4 }
    }, res)

    assert.equal(res.statusCode, 409)
    assert.equal(connection.committed, false)
    assert.equal(connection.rolledBack, true)
})

test('approved disciplines are rejected', async () => {
    const connection = new RequestConnection({ approved: true })
    const res = response()

    await handler(connection).solicitarVinculacion({
        usuario: { id_persona: 8, rol: 'ENTRENADOR' },
        body: { id_disciplina: 4 }
    }, res)

    assert.equal(res.statusCode, 409)
    assert.match(res.body.message, /aprobada/)
})

test('rejected requests can be submitted again', async () => {
    const connection = new RequestConnection()
    const res = response()

    await handler(connection).solicitarVinculacion({
        usuario: { id_persona: 8, rol: 'ENTRENADOR' },
        body: { id_disciplina: 4 }
    }, res)

    assert.equal(res.statusCode, 201)
})

test('nonexistent or inactive disciplines are rejected', async () => {
    const connection = new RequestConnection({ discipline: false })
    const res = response()

    await handler(connection).solicitarVinculacion({
        usuario: { id_persona: 8, rol: 'ENTRENADOR' },
        body: { id_disciplina: 4 }
    }, res)

    assert.equal(res.statusCode, 404)
})

test('trainer cannot resolve a request through the administrative route', () => {
    const route = router.stack.find((layer) =>
        layer.route?.path === '/solicitudes-vinculacion/:id/resolver' && layer.route.methods.post
    )
    assert.ok(route)
    const requireAdministrativeRole = route.route.stack[1].handle
    const res = response()

    requireAdministrativeRole({ usuario: { rol: 'ENTRENADOR' } }, res, () => {})

    assert.equal(res.statusCode, 403)
})
