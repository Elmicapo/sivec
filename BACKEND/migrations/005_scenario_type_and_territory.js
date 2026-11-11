function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function assertColumnAbsent(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  )
  assert(rows.length === 0, `${table}.${column} already exists; migration is not safe to continue.`)
}

async function assertColumnType(connection, table, column, expected) {
  const [rows] = await connection.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  )
  assert(rows.length === 1 && rows[0].COLUMN_TYPE === expected,
    `${table}.${column} has an unexpected type.`)
}

async function up(connection) {
  const [[database]] = await connection.query('SELECT DATABASE() AS name')
  assert(/^sivec_(?:restore_test|migration_test|isolated)_[a-z0-9_]+$/.test(database.name || ''),
    'Scenario correction migration requires an isolated SIVEC database.')

  for (const [table, column] of [
    ['solicitud_escenario', 'tipo_escenario'],
    ['escenario', 'zona'],
    ['escenario', 'tipo_localidad'],
    ['escenario', 'tipo_ubicacion'],
    ['escenario', 'comuna'],
    ['escenario', 'barrio'],
    ['escenario', 'corregimiento'],
    ['escenario', 'localidad_rural']
  ]) {
    await assertColumnAbsent(connection, table, column)
  }

  await assertColumnType(connection, 'solicitud_escenario', 'zona', "enum('URBANA','RURAL')")
  await assertColumnType(connection, 'solicitud_escenario', 'tipo_localidad',
    "enum('BARRIO','VEREDA','CENTRO_POBLADO','PENDIENTE_VERIFICACION')")
  await assertColumnType(connection, 'solicitud_escenario', 'tipo_ubicacion', "enum('GPS','MANUAL')")

  await connection.query(`
    ALTER TABLE solicitud_escenario
      ADD COLUMN tipo_escenario VARCHAR(60) NULL AFTER nombre_escenario
  `)

  await connection.query(`
    ALTER TABLE escenario
      ADD COLUMN zona ENUM('URBANA', 'RURAL') NULL AFTER ubicacion,
      ADD COLUMN tipo_localidad ENUM('BARRIO', 'VEREDA', 'CENTRO_POBLADO', 'PENDIENTE_VERIFICACION') NULL AFTER zona,
      ADD COLUMN tipo_ubicacion ENUM('GPS', 'MANUAL') NULL AFTER tipo_localidad,
      ADD COLUMN comuna VARCHAR(100) NULL AFTER tipo_ubicacion,
      ADD COLUMN barrio VARCHAR(120) NULL AFTER comuna,
      ADD COLUMN corregimiento VARCHAR(120) NULL AFTER barrio,
      ADD COLUMN localidad_rural VARCHAR(120) NULL AFTER corregimiento
  `)
}

module.exports = { up }
