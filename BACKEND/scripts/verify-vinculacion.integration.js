const assert = require('node:assert/strict')
const http = require('node:http')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')
const path = require('node:path')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

const DATABASE = 'sivec_restore_test_20261104_484fe0eb'
const PASSWORD = 'IntegrationTestPassword!2026'

function assertIsolatedDatabase(databaseName) {
    assert.equal(databaseName, DATABASE, 'D2 integration tests require the approved isolated database.')
    assert.notEqual(databaseName, 'deportes', 'D2 integration tests must never use deportes.')
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

function tokenFor(idPersona, role) {
    return jwt.sign({ id_persona: idPersona, rol: role }, process.env.JWT_SECRET, { expiresIn: '10m' })
}

async function main() {
    assertIsolatedDatabase(DATABASE)
    assert.ok(process.env.JWT_SECRET, 'JWT_SECRET is required for D2 integration checks.')
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
    const testTrainers = [
        {
            nombre_completo: `D2 Approved ${timestamp}`,
            numero_identificacion: `D2A${timestamp}`,
            correo_electronico: `d2.approved.${timestamp}@example.invalid`,
            login: `d2approved${String(timestamp).slice(-8)}`,
            telefono: '3000000001'
        },
        {
            nombre_completo: `D2 Rejected ${timestamp}`,
            numero_identificacion: `D2R${timestamp}`,
            correo_electronico: `d2.rejected.${timestamp}@example.invalid`,
            login: `d2rejected${String(timestamp).slice(-8)}`,
            telefono: '3000000002'
        }
    ]

    const server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = server.address().port
    let createdCronogramId = null
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
        assert.ok(admin, 'The isolated database needs an administrative test actor.')

        const [[discipline]] = await database.query(
            `SELECT id_disciplina
             FROM disciplina
             WHERE estado = 'ACTIVA'
             ORDER BY id_disciplina
             LIMIT 1`
        )
        assert.ok(discipline, 'The isolated database needs an active discipline.')

        const [[scenario]] = await database.query(
            `SELECT de.id_escenario
             FROM disciplina_escenario de
             JOIN escenario e ON e.id_escenario = de.id_escenario
             WHERE de.id_disciplina = ? AND e.activo
             ORDER BY de.id_escenario
             LIMIT 1`,
            [discipline.id_disciplina]
        )
        assert.ok(scenario, 'The selected active discipline needs an active scenario relation.')

        const [beforeRows] = await database.query(
            `SELECT
               (SELECT COUNT(*) FROM solicitud_vinculacion_entrenador) AS requests,
               (SELECT COUNT(*) FROM disciplina_entrenador) AS relations,
               (SELECT COUNT(*) FROM cronograma) AS schedules`
        )
        before = beforeRows[0]

        const registrations = []
        for (const trainer of testTrainers) {
            registrations.push(await request(port, '/api/auth/registro', {
                method: 'POST',
                body: {
                    ...trainer,
                    password: PASSWORD,
                    tipo_usuario: 'ENTRENADOR',
                    id_disciplina: discipline.id_disciplina
                }
            }))
        }
        assert.equal(registrations[0].status, 201)
        assert.equal(registrations[1].status, 201)

        const testPeople = await database.query(
            'SELECT id_persona, correo_electronico FROM persona WHERE correo_electronico IN (?, ?)',
            testTrainers.map((trainer) => trainer.correo_electronico)
        )
        const people = testPeople[0]
        assert.equal(people.length, 2)
        const peopleByEmail = new Map(people.map((person) => [person.correo_electronico, person.id_persona]))
        const approvedId = peopleByEmail.get(testTrainers[0].correo_electronico)
        const rejectedId = peopleByEmail.get(testTrainers[1].correo_electronico)

        const adminToken = tokenFor(admin.id_persona, 'ADMINISTRATIVO')
        const trainerToken = tokenFor(approvedId, 'ENTRENADOR')
        const pending = await request(port, '/api/entrenadores/solicitudes-vinculacion', {
            token: adminToken
        })
        assert.equal(pending.status, 200)
        assert.equal(pending.body.data.filter((row) =>
            [approvedId, rejectedId].includes(row.id_entrenador)
        ).length, 2)

        const requests = await database.query(
            `SELECT id_solicitud_vinculacion, id_entrenador, estado
             FROM solicitud_vinculacion_entrenador
             WHERE id_entrenador IN (?, ?)
             ORDER BY id_entrenador`,
            [approvedId, rejectedId]
        )
        assert.equal(requests[0].length, 2)
        const approvedRequest = requests[0].find((row) => row.id_entrenador === approvedId)
        const rejectedRequest = requests[0].find((row) => row.id_entrenador === rejectedId)
        assert.equal(approvedRequest.estado, 'PENDIENTE')
        assert.equal(rejectedRequest.estado, 'PENDIENTE')

        const approval = await request(
            port,
            `/api/entrenadores/solicitudes-vinculacion/${approvedRequest.id_solicitud_vinculacion}/resolver`,
            { method: 'POST', token: adminToken, body: { estado: 'APROBADA' } }
        )
        assert.equal(approval.status, 200)

        const rejection = await request(
            port,
            `/api/entrenadores/solicitudes-vinculacion/${rejectedRequest.id_solicitud_vinculacion}/resolver`,
            { method: 'POST', token: adminToken, body: { estado: 'RECHAZADA' } }
        )
        assert.equal(rejection.status, 200)

        const [[approvedRelation]] = await database.query(
            `SELECT 1 AS found FROM disciplina_entrenador
             WHERE id_disciplina = ? AND id_entrenador = ?`,
            [discipline.id_disciplina, approvedId]
        )
        const [[rejectedRelation]] = await database.query(
            `SELECT 1 AS found FROM disciplina_entrenador
             WHERE id_disciplina = ? AND id_entrenador = ?`,
            [discipline.id_disciplina, rejectedId]
        )
        assert.ok(approvedRelation)
        assert.equal(rejectedRelation, undefined)

        const secondApproval = await request(
            port,
            `/api/entrenadores/solicitudes-vinculacion/${approvedRequest.id_solicitud_vinculacion}/resolver`,
            { method: 'POST', token: adminToken, body: { estado: 'RECHAZADA' } }
        )
        assert.equal(secondApproval.status, 409)

        const cronogramaBody = {
            id_disciplina: discipline.id_disciplina,
            id_escenario: scenario.id_escenario,
            dia_semana: 'DOMINGO',
            hora_inicio: '08:00',
            hora_fin: '09:00',
            vigencia_desde: '2027-01-01'
        }
        const approvedSchedule = await request(port, '/api/cronogramas', {
            method: 'POST',
            token: trainerToken,
            body: cronogramaBody
        })
        assert.equal(approvedSchedule.status, 201)
        createdCronogramId = approvedSchedule.body.id_cronograma

        const rejectedSchedule = await request(port, '/api/cronogramas', {
            method: 'POST',
            token: tokenFor(rejectedId, 'ENTRENADOR'),
            body: cronogramaBody
        })
        assert.equal(rejectedSchedule.status, 400)
        assert.match(rejectedSchedule.body.message, /vinculación/)

        const [[resolved]] = await database.query(
            `SELECT
               (SELECT estado FROM solicitud_vinculacion_entrenador WHERE id_solicitud_vinculacion = ?) AS approved_state,
               (SELECT estado FROM solicitud_vinculacion_entrenador WHERE id_solicitud_vinculacion = ?) AS rejected_state`,
            [approvedRequest.id_solicitud_vinculacion, rejectedRequest.id_solicitud_vinculacion]
        )
        assert.equal(resolved.approved_state, 'APROBADA')
        assert.equal(resolved.rejected_state, 'RECHAZADA')

        console.log(JSON.stringify({
            database: target.database_name,
            mysql_version: target.mysql_version,
            checks: [
                'trainer registration creates pending requests',
                'administrative pending queue returns both test requests',
                'approval creates discipline_entrenador relation',
                'rejection does not create discipline_entrenador relation',
                'resolved request cannot be resolved twice',
                'approved trainer can create a cronograma',
                'rejected trainer cannot create a cronograma'
            ],
            before,
            created_test_records: {
                requests: 2,
                relations: 1,
                cronogramas: 1
            }
        }, null, 2))
    } finally {
        const [createdPeople] = await database.query(
            'SELECT id_persona FROM persona WHERE correo_electronico IN (?, ?)',
            testTrainers.map((trainer) => trainer.correo_electronico)
        )
        const ids = createdPeople.map((person) => person.id_persona)
        const placeholders = ids.map(() => '?').join(', ')
        if (createdCronogramId !== null) {
            await database.query('DELETE FROM cronograma WHERE id_cronograma = ?', [createdCronogramId])
        }
        if (ids.length) {
            await database.query(
                `DELETE FROM disciplina_entrenador WHERE id_entrenador IN (${placeholders})`,
                ids
            )
            await database.query(
                `DELETE FROM solicitud_vinculacion_entrenador WHERE id_entrenador IN (${placeholders})`,
                ids
            )
            await database.query(`DELETE FROM usuario WHERE id_persona IN (${placeholders})`, ids)
            await database.query(`DELETE FROM entrenador WHERE id_persona IN (${placeholders})`, ids)
            await database.query(`DELETE FROM persona WHERE id_persona IN (${placeholders})`, ids)
        }
        const [[after]] = await database.query(
            `SELECT
               (SELECT COUNT(*) FROM solicitud_vinculacion_entrenador) AS requests,
               (SELECT COUNT(*) FROM disciplina_entrenador) AS relations,
               (SELECT COUNT(*) FROM cronograma) AS schedules`
        )
        assert.equal(Number(after.requests), Number(before?.requests || after.requests))
        assert.equal(Number(after.relations), Number(before?.relations || after.relations))
        assert.equal(Number(after.schedules), Number(before?.schedules || after.schedules))
        await new Promise((resolve) => server.close(resolve))
        await applicationDatabase.end()
        await database.end()
    }
}

main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
})
