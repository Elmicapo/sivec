const assert = require('node:assert/strict')
const http = require('node:http')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')
const path = require('node:path')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

const DATABASE = 'sivec_restore_test_20261104_484fe0eb'
const ATHLETE_ID = 2
const SUCCESS_DISCIPLINE_ID = 5
const CROSSING_DISCIPLINE_ID = 2
const FULL_DISCIPLINE_ID = 1
const INACTIVE_DISCIPLINE_ID = 3
const TOKEN_SECRET = process.env.JWT_SECRET

function assertIsolatedDatabase(databaseName) {
    assert.equal(databaseName, DATABASE, 'Integration tests must use the approved isolated database.')
    assert.notEqual(databaseName, 'deportes', 'Integration tests must never use deportes.')
    assert.ok(TOKEN_SECRET, 'JWT_SECRET is required for the authenticated endpoint checks.')
}

function tokenFor(role, idPersona = ATHLETE_ID) {
    return jwt.sign({ id_persona: idPersona, rol: role }, TOKEN_SECRET, { expiresIn: '5m' })
}

function request(port, path, { method = 'GET', token, body } = {}) {
    return new Promise((resolve, reject) => {
        const requestOptions = {
            hostname: '127.0.0.1',
            port,
            path,
            method,
            headers: body ? { 'Content-Type': 'application/json' } : {}
        }
        if (token) requestOptions.headers.Authorization = `Bearer ${token}`

        const clientRequest = http.request(requestOptions, (response) => {
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

    const server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = server.address().port
    let createdId = null

    try {
        const [[target]] = await database.query(
            'SELECT DATABASE() AS database_name, VERSION() AS mysql_version'
        )
        assertIsolatedDatabase(target.database_name)
        assert.match(target.mysql_version, /^8\./)

        const [[schema]] = await database.query(
            `SELECT
               (SELECT COUNT(*) FROM information_schema.ROUTINES
                WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = 'sp_validar_inscripcion') AS procedure_count,
               (SELECT COUNT(*) FROM information_schema.TRIGGERS
                WHERE TRIGGER_SCHEMA = DATABASE()
                  AND EVENT_OBJECT_TABLE = 'inscripcion'
                  AND TRIGGER_NAME IN ('trg_inscripcion_bi', 'trg_inscripcion_bu')) AS trigger_count`
        )
        assert.equal(Number(schema.procedure_count), 1)
        assert.equal(Number(schema.trigger_count), 2)

        const [[before]] = await database.query('SELECT COUNT(*) AS total FROM inscripcion')
        const athleteToken = tokenFor('DEPORTISTA')
        const administrativeToken = tokenFor('ADMINISTRATIVO')

        const publicDisciplines = await request(port, '/api/disciplinas')
        assert.equal(publicDisciplines.status, 200)
        assert.ok(Array.isArray(publicDisciplines.body.data))

        const unauthenticated = await request(port, '/api/inscripciones', {
            method: 'POST',
            body: { id_disciplina: SUCCESS_DISCIPLINE_ID }
        })
        assert.equal(unauthenticated.status, 401)

        const wrongRole = await request(port, '/api/inscripciones', {
            method: 'POST',
            token: administrativeToken,
            body: { id_disciplina: SUCCESS_DISCIPLINE_ID }
        })
        assert.equal(wrongRole.status, 403)

        const success = await request(port, '/api/inscripciones', {
            method: 'POST',
            token: athleteToken,
            body: { id_disciplina: SUCCESS_DISCIPLINE_ID }
        })
        assert.equal(success.status, 201)
        assert.equal(success.body.success, true)
        assert.ok(success.body.id_inscripcion)
        createdId = success.body.id_inscripcion

        const [[stored]] = await database.query(
            `SELECT id_inscripcion, id_deportista, id_disciplina, estado
             FROM inscripcion
             WHERE id_deportista = ? AND id_disciplina = ? AND estado = 'ACTIVA'`,
            [ATHLETE_ID, SUCCESS_DISCIPLINE_ID]
        )
        assert.ok(stored)
        assert.equal(stored.id_deportista, ATHLETE_ID)
        assert.equal(stored.id_disciplina, SUCCESS_DISCIPLINE_ID)
        assert.equal(stored.id_inscripcion, success.body.id_inscripcion)

        const history = await request(port, '/api/disciplinas/mi-historial', {
            token: athleteToken
        })
        assert.equal(history.status, 200)
        assert.ok(history.body.data.some((row) => row.disciplina === 'Natación'))

        const duplicate = await request(port, '/api/inscripciones', {
            method: 'POST',
            token: athleteToken,
            body: { id_disciplina: SUCCESS_DISCIPLINE_ID }
        })
        assert.equal(duplicate.status, 409)

        const crossing = await request(port, '/api/inscripciones', {
            method: 'POST',
            token: athleteToken,
            body: { id_disciplina: CROSSING_DISCIPLINE_ID }
        })
        assert.equal(crossing.status, 400)
        assert.match(crossing.body.message, /cruce/)

        const fullAthleteToken = tokenFor('DEPORTISTA', 7)
        const full = await request(port, '/api/inscripciones', {
            method: 'POST',
            token: fullAthleteToken,
            body: { id_disciplina: FULL_DISCIPLINE_ID }
        })
        assert.equal(full.status, 400)
        assert.match(full.body.message, /cupos/)

        const inactive = await request(port, '/api/inscripciones', {
            method: 'POST',
            token: athleteToken,
            body: { id_disciplina: INACTIVE_DISCIPLINE_ID }
        })
        assert.equal(inactive.status, 400)
        assert.match(inactive.body.message, /activa/)

        await database.query('DELETE FROM inscripcion WHERE id_inscripcion = ?', [createdId])
        createdId = null
        const [[after]] = await database.query('SELECT COUNT(*) AS total FROM inscripcion')
        assert.equal(Number(after.total), Number(before.total))

        console.log(JSON.stringify({
            database: target.database_name,
            mysql_version: target.mysql_version,
            checks: [
                'public discipline query',
                'unauthenticated request rejected',
                'non-athlete role rejected',
                'real inscription persisted with id_persona',
                'history returned the persisted inscription',
                'duplicate enrollment rejected',
                'schedule crossing rule rejected by MySQL trigger',
                'full-discipline rule rejected by MySQL trigger',
                'inactive discipline rejected',
                'created test row cleaned and baseline restored',
                'sp_validar_inscripcion and both inscription triggers verified'
            ],
            baseline_inscriptions: Number(before.total),
            final_inscriptions: Number(after.total)
        }, null, 2))
    } finally {
        if (createdId !== null) {
            await database.query('DELETE FROM inscripcion WHERE id_inscripcion = ?', [createdId])
        }
        await new Promise((resolve) => server.close(resolve))
        await applicationDatabase.end()
        await database.end()
    }
}

main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
})
