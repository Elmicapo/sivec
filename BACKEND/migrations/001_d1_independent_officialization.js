function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function assertBaseTable(connection, table) {
  const [rows] = await connection.query(
    `SELECT ENGINE FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND TABLE_TYPE = 'BASE TABLE'`,
    [table]
  )
  assert(rows.length === 1 && rows[0].ENGINE === 'InnoDB', `${table} must exist as InnoDB.`)
}

async function up(connection) {
  const [[server]] = await connection.query('SELECT DATABASE() AS database_name, VERSION() AS mysql_version')
  assert(/^8\./.test(server.mysql_version), 'D1 migration requires MySQL 8.')

  for (const table of [
    'cmj_consejero',
    'reporte_veeduria',
    'escenario',
    'historial_estado_escenario'
  ]) {
    await assertBaseTable(connection, table)
  }

  const [columns] = await connection.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND ((TABLE_NAME = 'reporte_veeduria' AND COLUMN_NAME IN
         ('id_cmj_oficializa', 'fecha_oficializacion', 'id_cmj_valida'))
         OR (TABLE_NAME = 'historial_estado_escenario' AND COLUMN_NAME = 'id_reporte')
         OR (TABLE_NAME = 'cmj_consejero' AND COLUMN_NAME = 'id_persona'))`
  )
  const findColumn = (table, name) => columns.find((row) => row.TABLE_NAME === table && row.COLUMN_NAME === name)
  assert(!findColumn('reporte_veeduria', 'id_cmj_oficializa'), 'id_cmj_oficializa already exists.')
  assert(!findColumn('reporte_veeduria', 'fecha_oficializacion'), 'fecha_oficializacion already exists.')
  assert(findColumn('reporte_veeduria', 'id_cmj_valida')?.COLUMN_TYPE === 'int', 'id_cmj_valida must be signed INT.')
  assert(findColumn('cmj_consejero', 'id_persona')?.COLUMN_TYPE === 'int', 'cmj_consejero.id_persona must be signed INT.')
  assert(findColumn('historial_estado_escenario', 'id_reporte')?.COLUMN_TYPE === 'int', 'historial.id_reporte must be signed INT.')

  const [existingConstraints] = await connection.query(
    `SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND ((TABLE_NAME = 'reporte_veeduria' AND CONSTRAINT_NAME IN
         ('fk_reporte_cmj_oficializa', 'ck_reporte_oficializacion'))
         OR (TABLE_NAME = 'historial_estado_escenario' AND CONSTRAINT_NAME = 'uq_historial_reporte_oficializacion'))`
  )
  assert(existingConstraints.length === 0, 'One or more D1 constraint names are already in use.')

  const [indexes] = await connection.query(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND ((TABLE_NAME = 'reporte_veeduria' AND INDEX_NAME = 'ix_reporte_cmj_oficializa')
         OR (TABLE_NAME = 'historial_estado_escenario' AND INDEX_NAME = 'uq_historial_reporte_oficializacion'))`
  )
  assert(indexes.length === 0, 'One or more D1 index names are already in use.')

  const [[validationCheck]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_veeduria'
       AND CONSTRAINT_NAME = 'ck_reporte_validacion' AND CONSTRAINT_TYPE = 'CHECK'`
  )
  assert(Number(validationCheck.found) === 1, 'Existing ck_reporte_validacion was not found.')

  const [[duplicates]] = await connection.query(
    `SELECT COUNT(*) AS groups_found FROM (
       SELECT id_reporte FROM historial_estado_escenario
       WHERE id_reporte IS NOT NULL GROUP BY id_reporte HAVING COUNT(*) > 1
     ) AS duplicate_reports`
  )
  assert(Number(duplicates.groups_found) === 0, 'Duplicate non-null history report ids prevent the unique constraint.')

  const [[trigger]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'trg_oficializar_semaforo'`
  )
  assert(Number(trigger.found) === 1, 'Expected automatic D1 trigger was not found; inspect the schema before proceeding.')

  await connection.query(`
    ALTER TABLE reporte_veeduria
      ADD COLUMN id_cmj_oficializa INT NULL,
      ADD COLUMN fecha_oficializacion DATETIME NULL,
      ADD INDEX ix_reporte_cmj_oficializa (id_cmj_oficializa),
      ADD CONSTRAINT fk_reporte_cmj_oficializa
        FOREIGN KEY (id_cmj_oficializa)
        REFERENCES cmj_consejero (id_persona)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      ADD CONSTRAINT ck_reporte_oficializacion
        CHECK (
          (id_cmj_oficializa IS NULL AND fecha_oficializacion IS NULL)
          OR
          (id_cmj_oficializa IS NOT NULL AND fecha_oficializacion IS NOT NULL)
        )
  `)

  await connection.query(`
    ALTER TABLE historial_estado_escenario
      ADD CONSTRAINT uq_historial_reporte_oficializacion UNIQUE (id_reporte)
  `)

  await connection.query('DROP TRIGGER trg_oficializar_semaforo')

  const [[postflight]] = await connection.query(
    `SELECT
       (SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_veeduria'
          AND COLUMN_NAME IN ('id_cmj_oficializa', 'fecha_oficializacion')) AS new_columns,
       (SELECT COUNT(*) FROM information_schema.TRIGGERS
        WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'trg_oficializar_semaforo') AS old_trigger,
       (SELECT COUNT(*) FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'historial_estado_escenario'
          AND INDEX_NAME = 'uq_historial_reporte_oficializacion' AND NON_UNIQUE = 0) AS unique_history_index`
  )
  assert(Number(postflight.new_columns) === 2, 'D1 postflight: expected columns are missing.')
  assert(Number(postflight.old_trigger) === 0, 'D1 postflight: automatic trigger still exists.')
  assert(Number(postflight.unique_history_index) > 0, 'D1 postflight: unique history index is missing.')
}

module.exports = { up }
