const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const DATABASE = 'sivec_restore_test_20261104_484fe0eb';
process.env.DB_NAME = DATABASE;
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const app = require('../src/app');
const dbPool = require('../src/config/db');
const { createVeeduriaService } = require('../src/services/veeduria.service');

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function request(port, route, token) {
    return new Promise((resolve, reject) => {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const req = http.request({ host: '127.0.0.1', port, path: route, headers }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks)
            }));
        });
        req.on('error', reject);
        req.end();
    });
}

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
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    let report;
    let evidencePath;
    try {
        const [[actors]] = await database.query(
            `SELECT
               (SELECT id_persona FROM cmj_consejero ORDER BY id_persona LIMIT 1) AS cmj_id,
               (SELECT id_persona FROM persona ORDER BY id_persona LIMIT 1) AS other_id,
               (SELECT id_escenario FROM escenario ORDER BY id_escenario LIMIT 1) AS scenario_id`
        );
        assert.ok(actors.cmj_id && actors.scenario_id);
        report = await service.crearReporte({
            id_escenario: actors.scenario_id,
            nombre_completo: 'HTTP Evidence Check',
            correo_electronico: 'http-evidence@example.invalid',
            estado_propuesto: 'VERDE',
            descripcion: 'Temporary HTTP evidence check',
            evidencias: [{ contenido: png }]
        });
        const [[stored]] = await database.query(
            `SELECT ev.clave_objeto_privado
               FROM evidencia_veeduria ev
               JOIN solicitud_veeduria sv ON sv.id_solicitud_veeduria = ev.id_solicitud_veeduria
              WHERE sv.id_reporte = ?`,
            [report.id_reporte]
        );
        evidencePath = path.resolve(__dirname, '..', 'storage', 'private', 'veeduria', stored.clave_objeto_privado);
        const cmjToken = jwt.sign({ id_persona: actors.cmj_id, rol: 'CMJ' }, process.env.JWT_SECRET);
        const otherId = actors.other_id || actors.cmj_id + 100000;
        const responses = {
            cmj: await request(port, `/api/escenarios/reportes/${report.id_reporte}/evidencias/1`, cmjToken),
            administrativo: await request(port, `/api/escenarios/reportes/${report.id_reporte}/evidencias/1`, jwt.sign({ id_persona: otherId, rol: 'ADMINISTRATIVO' }, process.env.JWT_SECRET)),
            entrenador: await request(port, `/api/escenarios/reportes/${report.id_reporte}/evidencias/1`, jwt.sign({ id_persona: otherId, rol: 'ENTRENADOR' }, process.env.JWT_SECRET)),
            deportista: await request(port, `/api/escenarios/reportes/${report.id_reporte}/evidencias/1`, jwt.sign({ id_persona: otherId, rol: 'DEPORTISTA' }, process.env.JWT_SECRET)),
            anonimo: await request(port, `/api/escenarios/reportes/${report.id_reporte}/evidencias/1`),
            missing: await request(port, `/api/escenarios/reportes/${report.id_reporte}/evidencias/2`, cmjToken),
            invalidOrder: await request(port, `/api/escenarios/reportes/${report.id_reporte}/evidencias/6`, cmjToken)
        };
        assert.equal(responses.cmj.status, 200);
        assert.equal(responses.cmj.headers['content-type'].split(';')[0], 'image/png');
        assert.deepEqual(responses.cmj.body, Buffer.from(png, 'base64'));
        assert.equal(responses.administrativo.status, 403);
        assert.equal(responses.entrenador.status, 403);
        assert.equal(responses.deportista.status, 403);
        assert.equal(responses.anonimo.status, 401);
        assert.equal(responses.missing.status, 404);
        assert.equal(responses.invalidOrder.status, 400);
        assert.equal(responses.cmj.body.includes(evidencePath), false);
        console.log(JSON.stringify({
            database: DATABASE,
            checks: [
                'CMJ retrieves the stored evidence over HTTP',
                'administrative, trainer, athlete and anonymous access is denied',
                'missing evidence and invalid order return controlled errors',
                'response does not expose the physical storage path'
            ],
            statuses: Object.fromEntries(Object.entries(responses).map(([key, value]) => [key, value.status]))
        }, null, 2));
    } finally {
        if (report) {
            await database.beginTransaction();
            await database.query(
                `DELETE ev FROM evidencia_veeduria ev
                   JOIN solicitud_veeduria sv ON sv.id_solicitud_veeduria = ev.id_solicitud_veeduria
                  WHERE sv.id_reporte = ?`,
                [report.id_reporte]
            );
            await database.query('DELETE FROM reporte_veeduria_historial WHERE id_reporte = ?', [report.id_reporte]);
            await database.query('DELETE FROM solicitud_veeduria WHERE id_reporte = ?', [report.id_reporte]);
            await database.query('DELETE FROM reporte_veeduria WHERE id_reporte = ?', [report.id_reporte]);
            await database.commit();
        }
        if (evidencePath) await fs.unlink(evidencePath).catch(() => undefined);
        await new Promise((resolve) => server.close(resolve));
        await database.end();
        await dbPool.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
