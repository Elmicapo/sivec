const assert = require('node:assert/strict')
const http = require('node:http')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')
const path = require('node:path')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

const DATABASE = 'sivec_restore_test_20261104_484fe0eb'
const PASSWORD = 'IntegrationTestPassword!2026'

function assertIsolatedDatabase(databaseName) {
    assert.equal(databaseName, DATABASE, 'D2 request tests require the approved isolated database.')
    assert.notEqual(databaseName, 'deportes', 'D2 request tests must never use deportes.')
}

function tokenFor(idPersona, role) {
    return jwt.sign({ id_persona: idPersona, rol: role }, process.env.JWT_SECRET, { expiresIn: '10m' })
}

function request(port, path, { method = 'GET', token, body } = {}) {
    return new Promise((resolve, reject) => {
        const headers = {}
        if (body) headers['Content-Type'] = 'application/json'
        if (token) headers.Authorization = `Bearer ${token}`
        const clientRequest = http.request({
            hostname: '127.0.0.1',
            port,
            path,
            method,
            headers
        }, (response) => {
            let payload = ''
            response.setEncoding('utf8')
            response.on('data', (chunk) => { payload += chunk })
            response.on('end', () => {
                let parsed = null
                try { parsed = payload ? JSON.parse(payload) : null } catch {}
                resolve({ status: response.statusCode, body: parsed })
            })
        })
        clientRequest.on('error', reject)
        if (body) clientRequest.write(JSON.stringify(body))
        clientRequest.end()
    })
}

async function main() {
    assert.ok(process.env.JWT_SECRET, 'JWT_SECRET is required for D2 request checks.')
    assertIsolatedDatabase(DATABASE)
    process.env.DB_NAME = DATABASE

    const app = require('../src/app')
    const applicationDatabase = require('../src/config/db')
    const database = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: DATABASE,
        charset: 'utf8mb4',
        dateStrings: true,
        multipleStatements: false
    })
    const timestamp = Date.now()
    const trainer = {
        nombre_completo: `D2 Request ${timestamp}`,
        numero_identificacion: `D2Q${timestamp}`,
        correo_electronico: `d2.request.${timestamp}@example.invalid`,
        login: `d2request${String(timestamp).slice(-8)}`,
        telefono: '3000000003'
    }

    const server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = server.address().port
    let trainerId = null
    let before = null

    try {
        const [[target]] = await database.query(
            'SELECT DATABASE() AS database_name, VERSION() AS mysql_version'
        )
        assertIsolatedDatabase(target.database_name)
        assert.match(target.mysql_version, /^8\./)

        const [[admin]] = await database.query(
            'SELECT id_persona FROM administrativo ORDER BY id_persona LIMIT 1'
        )
        const [disciplineRows] = await database.query(
            `SELECT id_disciplina FROM disciplina
             WHERE estado = 'ACTIVA'
             ORDER BY id_disciplina
             LIMIT 2`
        )
        const [[inactive]] = await database.query(
            `SELECT id_disciplina FROM disciplina
             WHERE estado = 'INACTIVA'
             ORDER BY id_disciplina
             LIMIT 1`
        )
        assert.ok(admin && disciplineRows.length >= 1 && inactive)
        const disciplineId = disciplineRows[0].id_disciplina

        const [beforeRows] = await database.query(
            `SELECT
               (SELECT COUNT(*) FROM solicitud_vinculacion_entrenador) AS requests,
               (SELECT COUNT(*) FROM disciplina_entrenador) AS relations`
        )
        before = beforeRows[0]

        const registration = await request(port, '/api/auth/registro', {
            method: 'POST',
            body: {
                ...trainer,
                password: PASSWORD,
                tipo_usuario: 'ENTRENADOR',
                id_disciplina: disciplineId
            }
        })
        assert.equal(registration.status, 201)

        const [[createdPerson]] = await database.query(
            'SELECT id_persona FROM persona WHERE correo_electronico = ?',
            [trainer.correo_electronico]
        )
        trainerId = createdPerson.id_persona
        const trainerToken = tokenFor(trainerId, 'ENTRENADOR')
        const adminToken = tokenFor(admin.id_persona, 'ADMINISTRATIVO')

        const ownRequests = await request(port, '/api/entrenadores/mis-solicitudes', {
            token: trainerToken
        })
        assert.equal(ownRequests.status, 200)
        assert.equal(ownRequests.body.data.length, 1)
        assert.equal(ownRequests.body.data[0].estado, 'PENDIENTE')
        assert.equal(ownRequests.body.data[0].id_disciplina, disciplineId)

        const duplicatePending = await request(port, '/api/entrenadores/solicitudes-vinculacion', {
            method: 'POST',
            token: trainerToken,
            body: { id_disciplina: disciplineId }
        })
        assert.equal(duplicatePending.status, 409)

        const [[initialRequest]] = await database.query(
            `SELECT id_solicitud_vinculacion
             FROM solicitud_vinculacion_entrenador
             WHERE id_entrenador = ? AND id_disciplina = ? AND estado = 'PENDIENTE'`,
            [trainerId, disciplineId]
        )
        const reject = await request(
            port,
            `/api/entrenadores/solicitudes-vinculacion/${initialRequest.id_solicitud_vinculacion}/resolver`,
            { method: 'POST', token: adminToken, body: { estado: 'RECHAZADA' } }
        )
        assert.equal(reject.status, 200)

        const retryAfterRejection = await request(port, '/api/entrenadores/solicitudes-vinculacion', {
            method: 'POST',
            token: trainerToken,
            body: { id_disciplina: disciplineId }
        })
        assert.equal(retryAfterRejection.status, 201)

        const [[beforeApprovalRelation]] = await database.query(
            `SELECT 1 AS found FROM disciplina_entrenador
             WHERE id_entrenador = ? AND id_disciplina = ?`,
            [trainerId, disciplineId]
        )
        assert.equal(beforeApprovalRelation, undefined)

        const [[retryRequest]] = await database.query(
            `SELECT id_solicitud_vinculacion
             FROM solicitud_vinculacion_entrenador
             WHERE id_entrenador = ? AND id_disciplina = ? AND estado = 'PENDIENTE'
             ORDER BY id_solicitud_vinculacion DESC
             LIMIT 1`,
            [trainerId, disciplineId]
        )
        const approve = await request(
            port,
            `/api/entrenadores/solicitudes-vinculacion/${retryRequest.id_solicitud_vinculacion}/resolver`,
            { method: 'POST', token: adminToken, body: { estado: 'APROBADA' } }
        )
        assert.equal(approve.status, 200)

        const [[afterApprovalRelation]] = await database.query(
            `SELECT 1 AS found FROM disciplina_entrenador
             WHERE id_entrenador = ? AND id_disciplina = ?`,
            [trainerId, disciplineId]
        )
        assert.ok(afterApprovalRelation)

        const approvedAgain = await request(port, '/api/entrenadores/solicitudes-vinculacion', {
            method: 'POST',
            token: trainerToken,
            body: { id_disciplina: disciplineId }
        })
        assert.equal(approvedAgain.status, 409)

        const inactiveRequest = await request(port, '/api/entrenadores/solicitudes-vinculacion', {
            method: 'POST',
            token: trainerToken,
            body: { id_disciplina: inactive.id_disciplina }
        })
        assert.equal(inactiveRequest.status, 404)

        const trainerResolves = await request(
            port,
            `/api/entrenadores/solicitudes-vinculacion/${retryRequest.id_solicitud_vinculacion}/resolver`,
            { method: 'POST', token: trainerToken, body: { estado: 'RECHAZADA' } }
        )
        assert.equal(trainerResolves.status, 403)

        console.log(JSON.stringify({
            database: target.database_name,
            mysql_version: target.mysql_version,
            checks: [
                'trainer reads only own requests',
                'initial registration request is pending',
                'pending duplicate is rejected',
                'rejected request can be submitted again',
                'no relation exists before administrative approval',
                'approval creates the relation',
                'approved discipline cannot be requested again',
                'inactive discipline is rejected',
                'trainer cannot resolve a request'
            ],
            before,
            created_test_records: {
                requests: 2,
                relations: 1
            }
        }, null, 2))
    } finally {
        if (trainerId !== null) {
            await database.query('DELETE FROM disciplina_entrenador WHERE id_entrenador = ?', [trainerId])
            await database.query('DELETE FROM solicitud_vinculacion_entrenador WHERE id_entrenador = ?', [trainerId])
            await database.query('DELETE FROM usuario WHERE id_persona = ?', [trainerId])
            await database.query('DELETE FROM entrenador WHERE id_persona = ?', [trainerId])
            await database.query('DELETE FROM persona WHERE id_persona = ?', [trainerId])
        }
        const [[after]] = await database.query(
            `SELECT
               (SELECT COUNT(*) FROM solicitud_vinculacion_entrenador) AS requests,
               (SELECT COUNT(*) FROM disciplina_entrenador) AS relations`
        )
        assert.equal(Number(after.requests), Number(before?.requests || after.requests))
        assert.equal(Number(after.relations), Number(before?.relations || after.relations))
        await new Promise((resolve) => server.close(resolve))
        await applicationDatabase.end()
        await database.end()
    }
}

main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
})
