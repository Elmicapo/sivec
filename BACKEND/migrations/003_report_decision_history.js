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
  const [[server]] = await connection.query('SELECT VERSION() AS mysql_version')
  assert(/^8\./.test(server.mysql_version), 'Veeduría history migration requires MySQL 8.')

  for (const table of ['reporte_veeduria', 'cmj_consejero']) {
    await assertBaseTable(connection, table)
  }

  const [existingTables] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_veeduria_historial'`
  )
  assert(existingTables.length === 0, 'reporte_veeduria_historial already exists; inspect the schema.')

  const [columns] = await connection.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND ((TABLE_NAME = 'reporte_veeduria' AND COLUMN_NAME IN
         ('id_reporte', 'estado_reporte', 'id_cmj_valida'))
         OR (TABLE_NAME = 'cmj_consejero' AND COLUMN_NAME = 'id_persona'))`
  )
  const findColumn = (table, name) => columns.find((row) => row.TABLE_NAME === table && row.COLUMN_NAME === name)
  assert(findColumn('reporte_veeduria', 'id_reporte')?.COLUMN_TYPE === 'int', 'reporte_veeduria.id_reporte must be signed INT.')
  assert(findColumn('reporte_veeduria', 'id_cmj_valida')?.COLUMN_TYPE === 'int', 'reporte_veeduria.id_cmj_valida must be signed INT.')
  assert(findColumn('cmj_consejero', 'id_persona')?.COLUMN_TYPE === 'int', 'cmj_consejero.id_persona must be signed INT.')
  assert(findColumn('reporte_veeduria', 'estado_reporte'), 'reporte_veeduria.estado_reporte was not found.')

  await connection.query(`
    CREATE TABLE reporte_veeduria_historial (
      id_historial_reporte INT NOT NULL AUTO_INCREMENT,
      id_reporte INT NOT NULL,
      estado_anterior ENUM('PENDIENTE', 'VALIDADO', 'RECHAZADO') NULL,
      estado_nuevo ENUM('PENDIENTE', 'VALIDADO', 'RECHAZADO') NOT NULL,
      id_cmj INT NULL,
      observacion TEXT NULL,
      fecha_evento DATETIME NOT NULL,
      PRIMARY KEY (id_historial_reporte),
      KEY ix_reporte_veeduria_historial (id_reporte, fecha_evento),
      KEY ix_reporte_veeduria_historial_cmj (id_cmj),
      CONSTRAINT fk_reporte_veeduria_historial_reporte
        FOREIGN KEY (id_reporte) REFERENCES reporte_veeduria (id_reporte)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT fk_reporte_veeduria_historial_cmj
        FOREIGN KEY (id_cmj) REFERENCES cmj_consejero (id_persona)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT ck_reporte_veeduria_historial_actor
        CHECK (
          (estado_nuevo = 'PENDIENTE' AND estado_anterior IS NULL
            AND id_cmj IS NULL AND observacion IS NULL)
          OR
          (estado_nuevo IN ('VALIDADO', 'RECHAZADO') AND estado_anterior = 'PENDIENTE'
            AND id_cmj IS NOT NULL)
        )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  const [[postflight]] = await connection.query(
    `SELECT ENGINE FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_veeduria_historial'`
  )
  assert(postflight?.ENGINE === 'InnoDB', 'Report decision history table was not created as InnoDB.')
}

module.exports = { up }
