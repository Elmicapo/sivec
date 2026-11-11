const test = require('node:test')
const assert = require('node:assert/strict')
const {
    crearInscripcionesController,
    mensajeDeReglaMySQL
} = require('./inscripciones.controller')
const { crearHistorialDeportistaController } = require('./disciplinas.controller')

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

function database({ profile = true, discipline = { estado: 'ACTIVA' }, insertError = null } = {}) {
    const calls = []
    return {
        calls,
        async query(sql, values = []) {
            calls.push({ sql, values })
            if (sql.includes('information_schema.TABLES')) {
                return [[...values].map((name) => ({ name, type: 'BASE TABLE' }))]
            }
            if (sql.includes('FROM deportista')) return [profile ? [{}] : []]
            if (sql.includes('FROM disciplina')) return [discipline ? [discipline] : []]
            if (insertError) throw insertError
            return [{ affectedRows: 1, insertId: 10 }]
        }
    }
}

async function invoke(options, request = { id_disciplina: 4 }) {
    const db = database(options)
    const controller = crearInscripcionesController({ database: db })
    const res = response()
    await controller.inscribirDeportista({
        usuario: { id_persona: 8, rol: 'DEPORTISTA' },
        body: request
    }, res)
    return { db, res }
}

test('realiza una inscripción por disciplina con id_persona', async () => {
    const { db, res } = await invoke()
    assert.equal(res.statusCode, 201)
    assert.equal(res.body.success, true)
    assert.deepEqual(db.calls.at(-1).values, [8, 4])
    assert.match(db.calls.at(-1).sql, /INSERT INTO inscripcion/)
})

test('rechaza una inscripción duplicada', async () => {
    const { res } = await invoke({ insertError: { code: 'ER_DUP_ENTRY' } })
    assert.equal(res.statusCode, 409)
    assert.match(res.body.message, /inscripción activa/)
})

test('rechaza una disciplina inexistente', async () => {
    const { res } = await invoke({ discipline: null })
    assert.equal(res.statusCode, 404)
})

test('rechaza una disciplina inactiva', async () => {
    const { res } = await invoke({ discipline: { estado: 'INACTIVA' } })
    assert.equal(res.statusCode, 400)
    assert.match(res.body.message, /no está activa/)
})

test('rechaza una solicitud sin autenticación', async () => {
    const db = database()
    const controller = crearInscripcionesController({ database: db })
    const res = response()
    await controller.inscribirDeportista({ body: { id_disciplina: 4 } }, res)
    assert.equal(res.statusCode, 401)
    assert.equal(db.calls.length, 0)
})

test('rechaza un rol diferente a deportista', async () => {
    const db = database()
    const controller = crearInscripcionesController({ database: db })
    const res = response()
    await controller.inscribirDeportista({
        usuario: { id_persona: 8, rol: 'ENTRENADOR' },
        body: { id_disciplina: 4 }
    }, res)
    assert.equal(res.statusCode, 403)
    assert.equal(db.calls.length, 0)
})

test('rechaza un usuario sin perfil de deportista', async () => {
    const { res } = await invoke({ profile: false })
    assert.equal(res.statusCode, 400)
    assert.match(res.body.message, /perfil de deportista/)
})

test('clasifica el error de cupo emitido por MySQL', async () => {
    const { res } = await invoke({
        insertError: { sqlState: '45000', message: 'La disciplina no tiene cupos disponibles' }
    })
    assert.equal(res.statusCode, 400)
    assert.match(res.body.message, /cupos/)
    assert.equal(mensajeDeReglaMySQL({ sqlState: '45000', message: 'detalle interno' }), 'La inscripción no cumple una regla de integridad.')
})

test('clasifica el error de cruce de horarios emitido por MySQL', async () => {
    const { res } = await invoke({
        insertError: { sqlState: '45000', message: 'El deportista ya tiene un entrenamiento que se cruza en horario' }
    })
    assert.equal(res.statusCode, 400)
    assert.match(res.body.message, /cruce/)
})

test('oculta detalles de un error inesperado de MySQL', async () => {
    const { res } = await invoke({
        insertError: { code: 'ER_BAD_FIELD_ERROR', message: 'secret SQL detail' }
    })
    assert.equal(res.statusCode, 500)
    assert.deepEqual(res.body, {
        success: false,
        message: 'No fue posible procesar la inscripción.'
    })
})

test('el historial consulta la vista filtrando por id_persona', async () => {
    const calls = []
    const history = [{ disciplina: 'Fútbol', estado: 'ACTIVA' }]
    const controller = crearHistorialDeportistaController({
        database: {
            async query(sql, values) {
                calls.push({ sql, values })
                if (sql.includes('information_schema.TABLES')) {
                    return [[{ name: 'v_historial_deportista', type: 'VIEW' }]]
                }
                return [history]
            }
        }
    })
    const res = response()
    await controller({ usuario: { id_persona: 8 } }, res)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body.data, history)
    const historyQuery = calls.find(({ sql }) => sql.includes('v_historial_deportista'))
    assert.deepEqual(historyQuery.values, [8])
    assert.match(historyQuery.sql, /v_historial_deportista/)
})
