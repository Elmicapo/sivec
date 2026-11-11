const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const mysql = require('mysql2/promise');
const { createVeeduriaService, VeeduriaError } = require('../src/services/veeduria.service');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const DATABASE = 'sivec_restore_test_20261104_484fe0eb';

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: DATABASE,
        charset: 'utf8mb4',
        dateStrings: true,
        multipleStatements: false
    });

    let transactionOpen = false;
    const isolatedConnection = {
        query: connection.query.bind(connection),
        beginTransaction: async () => {
            if (!transactionOpen) {
                await connection.beginTransaction();
                transactionOpen = true;
            }
        },
        commit: async () => {},
        rollback: async () => {
            if (transactionOpen) {
                await connection.rollback();
                transactionOpen = false;
            }
        },
        release: () => {}
    };
    const service = createVeeduriaService({
        getConnection: async () => isolatedConnection,
        query: isolatedConnection.query
    });

    try {
        const [[target]] = await connection.query('SELECT DATABASE() AS database_name, VERSION() AS mysql_version');
        assert.equal(target.database_name, DATABASE);
        assert.match(target.mysql_version, /^8\./);

        const [migrations] = await connection.query(
            'SELECT version, status FROM sivec_schema_migrations WHERE version IN (?, ?, ?) ORDER BY version',
            ['001', '002', '003']
        );
        assert.deepEqual(migrations, [
            { version: '001', status: 'APPLIED' },
            { version: '002', status: 'APPLIED' },
            { version: '003', status: 'APPLIED' }
        ]);

        const [[actors]] = await connection.query(
            `SELECT
               (SELECT id_persona FROM cmj_consejero ORDER BY id_persona LIMIT 1) AS cmj_id,
               (SELECT p.id_persona FROM persona p
                  LEFT JOIN cmj_consejero c ON c.id_persona = p.id_persona
                 WHERE c.id_persona IS NULL
                 ORDER BY p.id_persona LIMIT 1) AS non_cmj_id,
               (SELECT id_escenario FROM escenario ORDER BY id_escenario LIMIT 1) AS scenario_id,
               (SELECT estado_semaforo FROM escenario ORDER BY id_escenario LIMIT 1) AS scenario_state`
        );
        assert.ok(actors.cmj_id && actors.scenario_id);
        assert.ok(actors.non_cmj_id);

        const [[baseline]] = await connection.query(
            `SELECT
               (SELECT COUNT(*) FROM reporte_veeduria) AS reports,
               (SELECT COUNT(*) FROM reporte_veeduria_historial) AS decisions,
               (SELECT COUNT(*) FROM historial_estado_escenario) AS officializations,
               (SELECT COUNT(*) FROM solicitud_veeduria) AS receipts`
        );

        const proposedState = ['VERDE', 'AMARILLO', 'ROJO'].find((state) => state !== actors.scenario_state);
        await assert.rejects(
            service.validarReporte({
                idReporte: 999999,
                estado: 'VALIDADO',
                observacion: null,
                idCmj: actors.non_cmj_id
            }),
            (error) => error instanceof VeeduriaError && error.code === 'CMJ_PROFILE_REQUIRED'
        );
        await connection.beginTransaction();
        transactionOpen = true;

        const receipt = await service.crearReporte({
            id_escenario: actors.scenario_id,
            nombre_completo: 'Integration Check',
            correo_electronico: 'integration@example.invalid',
            estado_propuesto: proposedState,
            descripcion: 'Temporary veeduría integration check',
            evidencias: [{
                contenido: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
            }]
        });
        const [[storedReceipt]] = await connection.query(
            `SELECT codigo_seguimiento_hash, nombre_contacto, correo_contacto
               FROM solicitud_veeduria WHERE id_reporte = ?`,
            [receipt.id_reporte]
        );
        const expectedHash = require('node:crypto')
            .createHash('sha256')
            .update(receipt.codigo_seguimiento)
            .digest();
        assert.ok(storedReceipt.codigo_seguimiento_hash.equals(expectedHash));
        assert.equal(storedReceipt.nombre_contacto, 'Integration Check');
        assert.equal(storedReceipt.correo_contacto, 'integration@example.invalid');
        const [[evidence]] = await connection.query(
            `SELECT orden, mime_real, ancho, alto, exif_eliminado
               FROM evidencia_veeduria ev
               JOIN solicitud_veeduria sv ON sv.id_solicitud_veeduria = ev.id_solicitud_veeduria
              WHERE sv.id_reporte = ?`,
            [receipt.id_reporte]
        );
        assert.deepEqual(evidence, {
            orden: 1,
            mime_real: 'image/png',
            ancho: 1,
            alto: 1,
            exif_eliminado: 1
        });

        const [[beforeOfficialization]] = await connection.query(
            `SELECT e.estado_semaforo,
                    (SELECT COUNT(*) FROM historial_estado_escenario h
                      WHERE h.id_reporte = r.id_reporte) AS history_count
               FROM reporte_veeduria r
               JOIN escenario e ON e.id_escenario = r.id_escenario
              WHERE r.id_reporte = ?`,
            [receipt.id_reporte]
        );
        const validation = await service.validarReporte({
            idReporte: receipt.id_reporte,
            estado: 'VALIDADO',
            observacion: null,
            idCmj: actors.cmj_id
        });
        assert.equal(validation.estado_reporte, 'VALIDADO');

        const [[afterValidation]] = await connection.query(
            `SELECT r.estado_reporte, e.estado_semaforo,
                    (SELECT COUNT(*) FROM historial_estado_escenario h
                      WHERE h.id_reporte = r.id_reporte) AS history_count
               FROM reporte_veeduria r
               JOIN escenario e ON e.id_escenario = r.id_escenario
              WHERE r.id_reporte = ?`,
            [receipt.id_reporte]
        );
        assert.equal(afterValidation.estado_reporte, 'VALIDADO');
        assert.equal(afterValidation.estado_semaforo, beforeOfficialization.estado_semaforo);
        assert.equal(Number(afterValidation.history_count), 0);

        const officializationQueue = await service.obtenerPendientesOficializacion();
        assert.ok(officializationQueue.some((row) => row.id_reporte === receipt.id_reporte));

        const officialization = await service.oficializarReporte({
            idReporte: receipt.id_reporte,
            idCmj: actors.cmj_id
        });
        assert.equal(officialization.estado_oficial, proposedState);
        const refreshedQueue = await service.obtenerPendientesOficializacion();
        assert.equal(refreshedQueue.some((row) => row.id_reporte === receipt.id_reporte), false);

        const detail = await service.obtenerDetalle(receipt.id_reporte);
        assert.equal(detail.estado_reporte, 'VALIDADO');
        assert.equal(detail.historial_decisiones.length, 2);
        assert.equal(detail.id_cmj_oficializa, actors.cmj_id);
        assert.equal(detail.correo_contacto, 'integration@example.invalid');
        const [officialHistoryRows] = await connection.query(
            'SELECT id_reporte, id_escenario, estado_anterior, estado_nuevo FROM historial_estado_escenario WHERE id_reporte = ?',
            [receipt.id_reporte]
        );
        assert.equal(officialHistoryRows.length, 1);
        const [[officialReportRow]] = await connection.query(
            'SELECT id_reporte, id_escenario FROM reporte_veeduria WHERE id_reporte = ?',
            [receipt.id_reporte]
        );
        assert.equal(Number(officialReportRow.id_escenario), Number(actors.scenario_id));
        const tracking = await service.obtenerSeguimiento(receipt.codigo_seguimiento);
        assert.equal(tracking.id_reporte, receipt.id_reporte);
        assert.equal(tracking.estado_reporte, 'VALIDADO');

        const history = await service.obtenerHistorialEscenario(actors.scenario_id);
        assert.ok(history.some((row) => Number(row.id_reporte) === Number(receipt.id_reporte)));

        const rejectedReceipt = await service.crearReporte({
            id_escenario: actors.scenario_id,
            nombre_completo: 'Integration Rejection',
            correo_electronico: 'integration-rejection@example.invalid',
            estado_propuesto: proposedState,
            descripcion: 'Temporary rejected veeduría integration check',
            evidencias: [{
                contenido: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
            }]
        });
        const rejected = await service.validarReporte({
            idReporte: rejectedReceipt.id_reporte,
            estado: 'RECHAZADO',
            observacion: 'La evidencia no permite confirmar el estado.',
            idCmj: actors.cmj_id
        });
        assert.equal(rejected.estado_reporte, 'RECHAZADO');

        const [storedEvidence] = await connection.query(
            'SELECT clave_objeto_privado FROM evidencia_veeduria ev JOIN solicitud_veeduria sv ON sv.id_solicitud_veeduria = ev.id_solicitud_veeduria WHERE sv.id_reporte IN (?, ?)',
            [receipt.id_reporte, rejectedReceipt.id_reporte]
        );
        await connection.rollback();
        transactionOpen = false;
        await Promise.all(storedEvidence.map(({ clave_objeto_privado }) =>
            fs.unlink(path.resolve(__dirname, '..', 'storage', 'private', 'veeduria', clave_objeto_privado)).catch(() => undefined)
        ));

        const [[afterRollback]] = await connection.query(
            `SELECT
               (SELECT COUNT(*) FROM reporte_veeduria) AS reports,
               (SELECT COUNT(*) FROM reporte_veeduria_historial) AS decisions,
               (SELECT COUNT(*) FROM historial_estado_escenario) AS officializations,
               (SELECT COUNT(*) FROM solicitud_veeduria) AS receipts`
        );
        assert.deepEqual(afterRollback, baseline);

        console.log(JSON.stringify({
            target: target.database_name,
            version: target.mysql_version,
            checks: [
                'public report with mandatory contact snapshot and hashed tracking code',
                'report starts pending and records decision history',
                'validation leaves the official scenario and officialization history unchanged',
                'D1 queue includes eligible reports and removes them after officialization',
                'CMJ officialization updates the scenario and records one history row',
                'CMJ detail and per-scenario history queries',
                'all synthetic rows and state changes rolled back'
            ],
            baseline,
            afterRollback
        }, null, 2));
    } finally {
        if (transactionOpen) await connection.rollback();
        await connection.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
