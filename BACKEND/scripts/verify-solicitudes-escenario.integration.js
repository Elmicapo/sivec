const assert = require('node:assert/strict');
const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createVeeduriaService } = require('../src/services/veeduria.service');

const DATABASE = 'sivec_restore_test_20261104_484fe0eb';

async function main() {
    const database = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: DATABASE,
        dateStrings: true,
        charset: 'utf8mb4'
    });
    const service = createVeeduriaService({
        getConnection: async () => ({
            query: database.query.bind(database),
            beginTransaction: database.beginTransaction.bind(database),
            commit: database.commit.bind(database),
            rollback: database.rollback.bind(database),
            release: () => undefined
        }),
        query: database.query.bind(database)
    });
    const created = { requests: [], scenarios: [] };
    try {
        const [[actors]] = await database.query(
            `SELECT
               (SELECT id_persona FROM cmj_consejero ORDER BY id_persona LIMIT 1) AS cmj_id,
               (SELECT id_disciplina FROM disciplina WHERE estado = 'ACTIVA' ORDER BY id_disciplina LIMIT 1) AS discipline_id,
               (SELECT nombre FROM disciplina WHERE estado = 'ACTIVA' ORDER BY id_disciplina LIMIT 1) AS discipline_name`
        );
        assert.ok(actors.cmj_id && actors.discipline_id);
        const before = {};
        for (const [key, table] of [
            ['requests', 'solicitud_escenario'],
            ['scenarios', 'escenario'],
            ['links', 'disciplina_escenario'],
            ['history', 'solicitud_escenario_historial']
        ]) {
            const [[row]] = await database.query(`SELECT COUNT(*) AS count FROM ${table}`);
            before[key] = Number(row.count);
        }

        const approvedName = `HTTP Proposal Approved ${Date.now()}`;
        const approvedRequest = await service.crearSolicitudEscenario({
            nombre_escenario: approvedName,
            tipo_escenario: 'CANCHA',
            id_disciplina: actors.discipline_id,
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
        created.requests.push(approvedRequest.id_solicitud_escenario);
        const pending = await service.obtenerSolicitudesEscenarioPendientes();
        assert.ok(pending.some((row) => row.id_solicitud_escenario === approvedRequest.id_solicitud_escenario));
        const approved = await service.resolverSolicitudEscenario({
            idSolicitud: approvedRequest.id_solicitud_escenario,
            estado: 'APROBADA',
            idCmj: actors.cmj_id,
            observacion: 'Ubicación verificada.'
        });
        created.scenarios.push(approved.id_escenario);
        assert.ok(approved.id_escenario);
        const [[approvedCheck]] = await database.query(
            `SELECT s.estado_revision, s.id_escenario, h.id_cmj,
                    (SELECT COUNT(*) FROM disciplina_escenario de WHERE de.id_escenario = s.id_escenario) AS links
               FROM solicitud_escenario s
               JOIN solicitud_escenario_historial h ON h.id_solicitud_escenario = s.id_solicitud_escenario
              WHERE s.id_solicitud_escenario = ?
              ORDER BY h.id_historial_solicitud DESC LIMIT 1`,
            [approvedRequest.id_solicitud_escenario]
        );
        assert.equal(approvedCheck.estado_revision, 'APROBADA');
        assert.equal(Number(approvedCheck.id_cmj), Number(actors.cmj_id));
        assert.equal(Number(approvedCheck.links), 1);
        const [[approvedScenario]] = await database.query(
            `SELECT e.nombre, e.ubicacion, e.zona, e.tipo_localidad, e.tipo_ubicacion,
                    e.comuna, e.barrio, e.corregimiento, e.localidad_rural, e.tipo,
                    de.id_disciplina
               FROM escenario e
               JOIN disciplina_escenario de ON de.id_escenario = e.id_escenario
              WHERE e.id_escenario = ?`,
            [approved.id_escenario]
        );
        assert.equal(approvedScenario.nombre, approvedName);
        assert.equal(approvedScenario.tipo, 'CANCHA');
        assert.equal(approvedScenario.ubicacion, 'Comuna 1 - La Paz');
        assert.equal(approvedScenario.zona, 'URBANA');
        assert.equal(approvedScenario.tipo_localidad, 'BARRIO');
        assert.equal(approvedScenario.tipo_ubicacion, 'MANUAL');
        assert.equal(approvedScenario.comuna, 'Comuna 1');
        assert.equal(approvedScenario.barrio, 'La Paz');
        assert.equal(approvedScenario.corregimiento, null);
        assert.equal(approvedScenario.localidad_rural, null);
        assert.equal(Number(approvedScenario.id_disciplina), Number(actors.discipline_id));

        const ruralName = `HTTP Proposal Rural ${Date.now()}`;
        const ruralRequest = await service.crearSolicitudEscenario({
            nombre_escenario: ruralName,
            tipo_escenario: 'PARQUE',
            id_disciplina: actors.discipline_id,
            zona: 'RURAL',
            comuna: null,
            barrio: null,
            corregimiento: 'Churidó',
            localidad_rural: 'Churidó Medio',
            tipo_localidad: 'VEREDA',
            tipo_ubicacion: 'GPS',
            latitud: 7.88,
            longitud: -76.62
        });
        created.requests.push(ruralRequest.id_solicitud_escenario);
        const ruralApproved = await service.resolverSolicitudEscenario({
            idSolicitud: ruralRequest.id_solicitud_escenario,
            estado: 'APROBADA',
            idCmj: actors.cmj_id,
            observacion: 'Datos territoriales verificados.'
        });
        created.scenarios.push(ruralApproved.id_escenario);
        const [[ruralScenario]] = await database.query(
            `SELECT e.nombre, e.ubicacion, e.zona, e.tipo_localidad, e.tipo_ubicacion,
                    e.corregimiento, e.localidad_rural, e.latitud, e.longitud, e.tipo,
                    de.id_disciplina
               FROM escenario e
               JOIN disciplina_escenario de ON de.id_escenario = e.id_escenario
              WHERE e.id_escenario = ?`,
            [ruralApproved.id_escenario]
        );
        assert.equal(ruralScenario.nombre, ruralName);
        assert.equal(ruralScenario.tipo, 'PARQUE');
        assert.equal(ruralScenario.ubicacion, 'Churidó - Churidó Medio');
        assert.equal(ruralScenario.zona, 'RURAL');
        assert.equal(ruralScenario.tipo_localidad, 'VEREDA');
        assert.equal(ruralScenario.tipo_ubicacion, 'GPS');
        assert.equal(ruralScenario.corregimiento, 'Churidó');
        assert.equal(ruralScenario.localidad_rural, 'Churidó Medio');
        assert.equal(Number(ruralScenario.latitud), 7.88);
        assert.equal(Number(ruralScenario.longitud), -76.62);
        assert.equal(Number(ruralScenario.id_disciplina), Number(actors.discipline_id));

        const rejectedRequest = await service.crearSolicitudEscenario({
            nombre_escenario: `HTTP Proposal Rejected ${Date.now()}`,
            tipo_escenario: 'ESTADIO',
            id_disciplina: actors.discipline_id,
            zona: 'RURAL',
            comuna: null,
            barrio: null,
            corregimiento: 'Churidó',
            localidad_rural: 'Churidó Medio',
            tipo_localidad: 'VEREDA',
            tipo_ubicacion: 'GPS',
            latitud: 7.88,
            longitud: -76.62
        });
        created.requests.push(rejectedRequest.id_solicitud_escenario);
        const rejected = await service.resolverSolicitudEscenario({
            idSolicitud: rejectedRequest.id_solicitud_escenario,
            estado: 'RECHAZADA',
            idCmj: actors.cmj_id,
            observacion: 'No cumple el criterio de inventario.'
        });
        assert.equal(rejected.id_escenario, null);
        const [[rejectedCheck]] = await database.query(
            'SELECT estado_revision, id_escenario FROM solicitud_escenario WHERE id_solicitud_escenario = ?',
            [rejectedRequest.id_solicitud_escenario]
        );
        assert.equal(rejectedCheck.estado_revision, 'RECHAZADA');
        assert.equal(rejectedCheck.id_escenario, null);

        const [legacyResult] = await database.query(
            `INSERT INTO solicitud_escenario
                (nombre_escenario, id_disciplina, zona, comuna, barrio,
                 corregimiento, localidad_rural, tipo_localidad, tipo_ubicacion,
                 latitud, longitud, fecha_solicitud)
             VALUES (?, ?, 'URBANA', 'Comuna 1', 'La Paz', NULL, NULL, 'BARRIO', 'MANUAL', NULL, NULL, UTC_TIMESTAMP())`,
            [`Legacy Proposal ${Date.now()}`, actors.discipline_id]
        );
        created.requests.push(legacyResult.insertId);
        await database.query(
            `INSERT INTO solicitud_escenario_historial
                (id_solicitud_escenario, estado_anterior, estado_nuevo, id_cmj, observacion, fecha_evento)
             VALUES (?, NULL, 'PENDIENTE', NULL, NULL, UTC_TIMESTAMP())`,
            [legacyResult.insertId]
        );
        await assert.rejects(
            service.resolverSolicitudEscenario({
                idSolicitud: legacyResult.insertId,
                estado: 'APROBADA',
                idCmj: actors.cmj_id,
                observacion: 'Debe rechazarse sin tipo físico.'
            }),
            (error) => error.code === 'SCENARIO_TYPE_REQUIRED'
        );

        console.log(JSON.stringify({ database: DATABASE, before, approvedScenario, ruralScenario, discipline: actors.discipline_name, checks: [
            'public scenario proposal persisted as PENDIENTE',
            'CMJ approval created scenario and discipline relation',
            'CMJ approval recorded resolver and history',
            'rural GPS territory and coordinates were preserved',
            'CMJ rejection did not create an official scenario',
            'legacy proposal without physical type cannot be approved'
        ] }, null, 2));
    } finally {
        await database.beginTransaction();
        if (created.scenarios.length) {
            await database.query('DELETE FROM disciplina_escenario WHERE id_escenario IN (?)', [created.scenarios]);
        }
        if (created.requests.length) {
            await database.query('DELETE FROM solicitud_escenario_historial WHERE id_solicitud_escenario IN (?)', [created.requests]);
            await database.query('DELETE FROM solicitud_escenario WHERE id_solicitud_escenario IN (?)', [created.requests]);
        }
        if (created.scenarios.length) {
            await database.query('DELETE FROM escenario WHERE id_escenario IN (?)', [created.scenarios]);
        }
        await database.commit();
        await database.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
