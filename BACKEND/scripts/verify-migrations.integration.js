const assert = require('node:assert/strict')
const path = require('node:path')
const mysql = require('mysql2/promise')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

const DATABASE = 'sivec_restore_test_20261104_484fe0eb'

async function expectRejected(promise, expectedCodes, label) {
  try {
    await promise
  } catch (error) {
    assert.ok(expectedCodes.includes(error.code), `${label}: unexpected error ${error.code}`)
    return
  }
  assert.fail(`${label}: invalid data was accepted`)
}

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
  })

  let inTransaction = false
  try {
    const [[target]] = await connection.query('SELECT DATABASE() AS database_name, VERSION() AS mysql_version')
    assert.equal(target.database_name, DATABASE)
    assert.match(target.mysql_version, /^8\./)

    const [migrationRows] = await connection.query(
      'SELECT version, status FROM sivec_schema_migrations ORDER BY version'
    )
    assert.deepEqual(migrationRows, [
      { version: '001', status: 'APPLIED' },
      { version: '002', status: 'APPLIED' },
      { version: '003', status: 'APPLIED' }
    ])

    const [[decisionHistoryTable]] = await connection.query(
      `SELECT ENGINE FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_veeduria_historial'`
    )
    assert.equal(decisionHistoryTable.ENGINE, 'InnoDB')

    const [[baseline]] = await connection.query(
      `SELECT
         (SELECT COUNT(*) FROM reporte_veeduria) AS reports,
         (SELECT COUNT(*) FROM reporte_veeduria_historial) AS decisions,
         (SELECT COUNT(*) FROM historial_estado_escenario) AS history_rows,
         (SELECT COUNT(*) FROM escenario) AS scenarios`
    )
    assert.equal(Number(baseline.reports), 3)
    assert.equal(Number(baseline.history_rows), 2)
    assert.equal(Number(baseline.scenarios), 3)

    const [[d1]] = await connection.query(
      `SELECT
         (SELECT COUNT(*) FROM information_schema.TRIGGERS
          WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'trg_oficializar_semaforo') AS old_trigger,
         (SELECT COUNT(*) FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'historial_estado_escenario'
            AND INDEX_NAME = 'uq_historial_reporte_oficializacion' AND NON_UNIQUE = 0) AS unique_history_index,
         (SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS
          WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'ck_reporte_oficializacion') AS officialization_check`
    )
    assert.equal(Number(d1.old_trigger), 0)
    assert.ok(Number(d1.unique_history_index) > 0)
    assert.equal(Number(d1.officialization_check), 1)

    const [[refs]] = await connection.query(
      `SELECT COUNT(*) AS found FROM information_schema.KEY_COLUMN_USAGE
       WHERE CONSTRAINT_SCHEMA = DATABASE()
         AND ((TABLE_NAME = 'reporte_veeduria' AND COLUMN_NAME = 'id_cmj_oficializa'
           AND REFERENCED_TABLE_NAME = 'cmj_consejero')
           OR (TABLE_NAME = 'solicitud_escenario' AND COLUMN_NAME = 'id_disciplina'
           AND REFERENCED_TABLE_NAME = 'disciplina')
           OR (TABLE_NAME = 'solicitud_veeduria' AND COLUMN_NAME = 'id_solicitud_escenario'
           AND REFERENCED_TABLE_NAME = 'solicitud_escenario')
           OR (TABLE_NAME = 'evidencia_veeduria' AND COLUMN_NAME = 'id_solicitud_veeduria'
           AND REFERENCED_TABLE_NAME = 'solicitud_veeduria'))`
    )
    assert.equal(Number(refs.found), 4)

    const [[schemaIntegrity]] = await connection.query(
      `SELECT
         (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
          WHERE CONSTRAINT_SCHEMA = DATABASE()) AS foreign_keys,
         (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
          WHERE CONSTRAINT_SCHEMA = DATABASE()
            AND CONSTRAINT_TYPE = 'CHECK' AND ENFORCED = 'YES') AS enforced_checks,
         (SELECT COUNT(*) FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE') AS base_tables,
         (SELECT COUNT(*) FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
            AND ENGINE = 'InnoDB') AS innodb_tables`
    )
    assert.equal(Number(schemaIntegrity.foreign_keys), 32)
    assert.equal(Number(schemaIntegrity.enforced_checks), 18)
    assert.equal(Number(schemaIntegrity.base_tables), Number(schemaIntegrity.innodb_tables))

    const [[contactSchema]] = await connection.query(
      `SELECT
         (SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'solicitud_veeduria'
            AND COLUMN_NAME IN ('nombre_contacto', 'correo_contacto')) AS required_contact_fields,
         (SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'solicitud_veeduria'
            AND COLUMN_NAME = 'numero_identificacion') AS identity_number_fields,
         (SELECT IS_NULLABLE FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_veeduria'
            AND COLUMN_NAME = 'id_reportante') AS legacy_reporter_nullable`
    )
    assert.equal(Number(contactSchema.required_contact_fields), 2)
    assert.equal(Number(contactSchema.identity_number_fields), 0)
    assert.equal(contactSchema.legacy_reporter_nullable, 'YES')

    const [[actors]] = await connection.query(
      `SELECT
         (SELECT id_persona FROM cmj_consejero ORDER BY id_persona LIMIT 1) AS cmj_id,
         (SELECT id_disciplina FROM disciplina ORDER BY id_disciplina LIMIT 1) AS discipline_id,
         (SELECT id_escenario FROM escenario ORDER BY id_escenario LIMIT 1) AS scenario_id,
         (SELECT estado_semaforo FROM escenario ORDER BY id_escenario LIMIT 1) AS scenario_state`
    )
    assert.ok(actors.cmj_id && actors.discipline_id && actors.scenario_id)

    await connection.beginTransaction()
    inTransaction = true

    await expectRejected(
      connection.query(
        `INSERT INTO reporte_veeduria
          (id_escenario, id_reportante, estado_propuesto, descripcion, id_cmj_oficializa)
         VALUES (?, NULL, 'VERDE', 'constraint probe', ?)`,
        [actors.scenario_id, actors.cmj_id]
      ),
      ['ER_CHECK_CONSTRAINT_VIOLATED'],
      'D1 actor/date pair check'
    )

    const [created] = await connection.query(
      `INSERT INTO reporte_veeduria
        (id_escenario, id_reportante, estado_propuesto, descripcion, fecha_reporte)
       VALUES (?, NULL, ?, 'migration integration probe', UTC_TIMESTAMP())`,
      [actors.scenario_id, actors.scenario_state]
    )
    const reportId = created.insertId
    await connection.query(
      `INSERT INTO reporte_veeduria_historial
        (id_reporte, estado_anterior, estado_nuevo, id_cmj, observacion, fecha_evento)
       VALUES (?, NULL, 'PENDIENTE', NULL, NULL, UTC_TIMESTAMP())`,
      [reportId]
    )
    await expectRejected(
      connection.query(
        `INSERT INTO reporte_veeduria_historial
          (id_reporte, estado_anterior, estado_nuevo, id_cmj, observacion, fecha_evento)
         VALUES (?, 'PENDIENTE', 'RECHAZADO', NULL, 'must have actor', UTC_TIMESTAMP())`,
        [reportId]
      ),
      ['ER_CHECK_CONSTRAINT_VIOLATED'],
      'report decision history actor constraint'
    )
    await connection.query(
      `UPDATE reporte_veeduria SET estado_reporte = 'VALIDADO', id_cmj_valida = ?,
        fecha_validacion = UTC_TIMESTAMP() WHERE id_reporte = ?`,
      [actors.cmj_id, reportId]
    )
    await connection.query(
      `INSERT INTO reporte_veeduria_historial
        (id_reporte, estado_anterior, estado_nuevo, id_cmj, observacion, fecha_evento)
       VALUES (?, 'PENDIENTE', 'VALIDADO', ?, NULL, UTC_TIMESTAMP())`,
      [reportId, actors.cmj_id]
    )
    const [[validationProbe]] = await connection.query(
      `SELECT r.estado_reporte, e.estado_semaforo,
         (SELECT COUNT(*) FROM historial_estado_escenario h WHERE h.id_reporte = r.id_reporte) AS history_count
       FROM reporte_veeduria r JOIN escenario e ON e.id_escenario = r.id_escenario
       WHERE r.id_reporte = ?`,
      [reportId]
    )
    assert.equal(validationProbe.estado_reporte, 'VALIDADO')
    assert.equal(validationProbe.estado_semaforo, actors.scenario_state)
    assert.equal(Number(validationProbe.history_count), 0)

    const [[viewProbe]] = await connection.query(
      'SELECT id_reporte, reportante FROM v_historico_veedurias WHERE id_reporte = ?',
      [reportId]
    )
    assert.equal(Number(viewProbe.id_reporte), reportId)
    assert.equal(viewProbe.reportante, null)

    const [[legacyHistory]] = await connection.query(
      `SELECT id_escenario, estado_anterior, estado_nuevo, id_reporte, id_cmj, fecha_cambio
       FROM historial_estado_escenario WHERE id_reporte IS NOT NULL LIMIT 1`
    )
    assert.ok(legacyHistory, 'Expected legacy history row was not found.')
    await expectRejected(
      connection.query(
        `INSERT INTO historial_estado_escenario
          (id_escenario, estado_anterior, estado_nuevo, id_reporte, id_cmj, fecha_cambio)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          legacyHistory.id_escenario,
          legacyHistory.estado_anterior,
          legacyHistory.estado_nuevo,
          legacyHistory.id_reporte,
          legacyHistory.id_cmj,
          legacyHistory.fecha_cambio
        ]
      ),
      ['ER_DUP_ENTRY'],
      'D1 one history row per report constraint'
    )

    await expectRejected(
      connection.query(
        `INSERT INTO solicitud_escenario
          (nombre_escenario, id_disciplina, zona, comuna, barrio, tipo_localidad,
           tipo_ubicacion, latitud, longitud, fecha_solicitud)
         VALUES ('constraint probe', ?, 'URBANA', NULL, NULL, 'BARRIO',
           'MANUAL', NULL, NULL, UTC_TIMESTAMP())`,
        [actors.discipline_id]
      ),
      ['ER_CHECK_CONSTRAINT_VIOLATED'],
      'territorial hierarchy constraint'
    )

    const [proposal] = await connection.query(
      `INSERT INTO solicitud_escenario
        (nombre_escenario, id_disciplina, zona, corregimiento, localidad_rural,
         tipo_localidad, tipo_ubicacion, estado_revision, fecha_solicitud)
       VALUES ('proposal integration probe', ?, 'RURAL', 'El Reposo', 'Localidad por verificar',
         'PENDIENTE_VERIFICACION', 'MANUAL', 'PENDIENTE', UTC_TIMESTAMP())`,
      [actors.discipline_id]
    )
    const proposalId = proposal.insertId
    await connection.query(
      `INSERT INTO solicitud_escenario_historial
        (id_solicitud_escenario, estado_anterior, estado_nuevo, fecha_evento)
       VALUES (?, NULL, 'PENDIENTE', UTC_TIMESTAMP())`,
      [proposalId]
    )
    await connection.query(
      `UPDATE solicitud_escenario
       SET estado_revision = 'APROBADA', id_cmj_revisa = ?, fecha_revision = UTC_TIMESTAMP(),
           id_escenario = ?
       WHERE id_solicitud_escenario = ?`,
      [actors.cmj_id, actors.scenario_id, proposalId]
    )
    await connection.query(
      `INSERT INTO solicitud_escenario_historial
        (id_solicitud_escenario, estado_anterior, estado_nuevo, id_cmj, fecha_evento)
       VALUES (?, 'PENDIENTE', 'APROBADA', ?, UTC_TIMESTAMP())`,
      [proposalId, actors.cmj_id]
    )

    await expectRejected(
      connection.query(
        `INSERT INTO solicitud_escenario
          (nombre_escenario, id_disciplina, zona, corregimiento, localidad_rural,
           tipo_localidad, tipo_ubicacion, latitud, longitud, fecha_solicitud)
         VALUES ('gps probe', ?, 'RURAL', 'El Reposo', 'Localidad por verificar',
           'PENDIENTE_VERIFICACION', 'MANUAL', 7.88, -76.62, UTC_TIMESTAMP())`,
        [actors.discipline_id]
      ),
      ['ER_CHECK_CONSTRAINT_VIOLATED'],
      'manual location must not store coordinates'
    )

    await expectRejected(
      connection.query(
        `INSERT INTO solicitud_veeduria
          (codigo_seguimiento_hash, nombre_contacto, correo_contacto, estado_propuesto,
           descripcion, fecha_recepcion)
         VALUES (?, 'Prueba', 'test@example.invalid', 'VERDE', 'constraint probe', UTC_TIMESTAMP())`,
        [Buffer.alloc(32, 1)]
      ),
      ['ER_CHECK_CONSTRAINT_VIOLATED'],
      'receipt must point to exactly one scenario target'
    )

    const [receipt] = await connection.query(
      `INSERT INTO solicitud_veeduria
        (codigo_seguimiento_hash, nombre_contacto, correo_contacto, id_solicitud_escenario,
         estado_propuesto, descripcion, fecha_recepcion)
       VALUES (?, 'Prueba de integración', 'test@example.invalid', ?, 'AMARILLO',
         'Reporte sintético para verificar el esquema', UTC_TIMESTAMP())`,
      [Buffer.alloc(32, 2), proposalId]
    )
    const receiptId = receipt.insertId

    await connection.query(
      `INSERT INTO evidencia_veeduria
        (id_solicitud_veeduria, orden, clave_objeto_privado, mime_real,
         bytes_original, bytes_optimizada, ancho, alto, sha256, exif_eliminado, fecha_registro)
       VALUES (?, 1, 'private-test-object-valid', 'image/webp',
         100000, 90000, 640, 480, ?, 1, UTC_TIMESTAMP())`,
      [receiptId, Buffer.alloc(32, 5)]
    )

    await expectRejected(
      connection.query(
        `INSERT INTO evidencia_veeduria
          (id_solicitud_veeduria, orden, clave_objeto_privado, mime_real,
           bytes_original, bytes_optimizada, ancho, alto, sha256, exif_eliminado, fecha_registro)
         VALUES (?, 1, 'private-test-object-invalid-size', 'image/jpeg',
           5242881, 1000, 100, 100, ?, 1, UTC_TIMESTAMP())`,
        [receiptId, Buffer.alloc(32, 3)]
      ),
      ['ER_CHECK_CONSTRAINT_VIOLATED'],
      'individual image byte limit'
    )
    await expectRejected(
      connection.query(
        `INSERT INTO evidencia_veeduria
          (id_solicitud_veeduria, orden, clave_objeto_privado, mime_real,
           bytes_original, bytes_optimizada, ancho, alto, sha256, exif_eliminado, fecha_registro)
         VALUES (?, 6, 'private-test-object-invalid-order', 'image/jpeg',
           1000, 900, 100, 100, ?, 1, UTC_TIMESTAMP())`,
        [receiptId, Buffer.alloc(32, 4)]
      ),
      ['ER_CHECK_CONSTRAINT_VIOLATED'],
      'maximum five image slots'
    )

    await connection.rollback()
    inTransaction = false

    const [[afterRollback]] = await connection.query(
      `SELECT
         (SELECT COUNT(*) FROM reporte_veeduria) AS reports,
         (SELECT COUNT(*) FROM reporte_veeduria_historial) AS decisions,
         (SELECT COUNT(*) FROM historial_estado_escenario) AS history_rows,
         (SELECT COUNT(*) FROM solicitud_escenario) AS proposals,
         (SELECT COUNT(*) FROM solicitud_escenario_historial) AS proposal_history,
         (SELECT COUNT(*) FROM solicitud_veeduria) AS receipts,
         (SELECT COUNT(*) FROM evidencia_veeduria) AS evidence`
    )
    assert.equal(Number(afterRollback.reports), Number(baseline.reports))
    assert.equal(Number(afterRollback.history_rows), Number(baseline.history_rows))
    assert.equal(Number(afterRollback.proposals), 0)
    assert.equal(Number(afterRollback.proposal_history), 0)
    assert.equal(Number(afterRollback.receipts), 0)
    assert.equal(Number(afterRollback.evidence), 0)

    console.log(JSON.stringify({
      target: target.database_name,
      version: target.mysql_version,
      migrations: migrationRows,
      baselineRowsPreserved: baseline,
      checks: [
        'D1 column-pair CHECK',
        'validation does not change scenario or create officialization history',
        'report decision history requires a CMJ actor and rolls back with the report',
        'historical view retains a report without a persona link and does not expose snapshot contact',
        'one D1 history row per report',
        '32 foreign keys, 18 enforced checks, and all base tables use InnoDB',
        'mandatory contact snapshots without an identity-number field',
        'scenario approval actor, state, link, and history constraints',
        'scenario territorial and GPS/manual constraints',
        'required scenario target on every receipt',
        'valid evidence relation plus size and maximum-slot constraints',
        'transaction rollback leaves no test rows'
      ],
      afterRollback
    }, null, 2))
  } finally {
    if (inTransaction) await connection.rollback()
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
