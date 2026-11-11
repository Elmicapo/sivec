const crypto = require('node:crypto')
const mysql = require('mysql2/promise')
const { canonicalJson } = require('./migration-safety')

const BASE_TABLES = [
  'disciplina',
  'cmj_consejero',
  'escenario',
  'historial_estado_escenario',
  'persona',
  'reporte_veeduria'
]
const REPORTAR_TABLES = [
  'solicitud_escenario',
  'solicitud_escenario_historial',
  'solicitud_veeduria',
  'evidencia_veeduria'
]

function createConnection(database) {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
    charset: 'utf8mb4',
    dateStrings: true,
    multipleStatements: false
  })
}

async function getIdentity(connection) {
  const [[identity]] = await connection.query(
    'SELECT DATABASE() AS database_name, VERSION() AS mysql_version, @@hostname AS server_hostname, @@port AS server_port'
  )
  return {
    database: identity.database_name,
    mysqlVersion: identity.mysql_version,
    serverHostname: identity.server_hostname,
    serverPort: Number(identity.server_port),
    configuredHost: process.env.DB_HOST || 'localhost',
    configuredPort: Number(process.env.DB_PORT || 3306)
  }
}

async function readSchemaSnapshot(connection) {
  const [tables] = await connection.query(
    `SELECT TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_COLLATION, CREATE_OPTIONS
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
     ORDER BY TABLE_NAME`
  )
  const [columns] = await connection.query(
    `SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_TYPE, IS_NULLABLE,
            COLUMN_DEFAULT, EXTRA, GENERATION_EXPRESSION, CHARACTER_SET_NAME, COLLATION_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME, ORDINAL_POSITION`
  )
  const [indexes] = await connection.query(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME,
            COLLATION, SUB_PART, INDEX_TYPE
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`
  )
  const [constraints] = await connection.query(
    `SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME, CONSTRAINT_NAME`
  )
  const [references] = await connection.query(
    `SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, ORDINAL_POSITION,
            REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE CONSTRAINT_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`
  )
  const [checks] = await connection.query(
    `SELECT tc.TABLE_NAME, tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE, cc.ENFORCED
     FROM information_schema.TABLE_CONSTRAINTS tc
     JOIN information_schema.CHECK_CONSTRAINTS cc
       ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
      AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
     WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.CONSTRAINT_TYPE = 'CHECK'
     ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_NAME`
  )
  const [triggers] = await connection.query(
    `SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING,
            ACTION_STATEMENT, ACTION_ORDER, SQL_MODE
     FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = DATABASE()
     ORDER BY TRIGGER_NAME`
  )
  const [views] = await connection.query(
    `SELECT TABLE_NAME, VIEW_DEFINITION, CHECK_OPTION, IS_UPDATABLE,
            SECURITY_TYPE, DEFINER
     FROM information_schema.VIEWS
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME`
  )
  const [foreignKeyRules] = await connection.query(
     `SELECT CONSTRAINT_NAME, TABLE_NAME, UPDATE_RULE, DELETE_RULE
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, CONSTRAINT_NAME`
  )
  const baseTables = tables.filter((table) => table.TABLE_TYPE === 'BASE TABLE')
  const counts = {}
  for (const { TABLE_NAME } of baseTables) {
    const [[row]] = await connection.query(`SELECT COUNT(*) AS row_count FROM ??`, [TABLE_NAME])
    counts[TABLE_NAME] = Number(row.row_count)
  }
  const structure = {
    tables,
    columns,
    indexes,
    constraints,
    references,
    foreignKeyRules,
    checks,
    triggers,
    views
  }
  return {
    schemaSha256: crypto.createHash('sha256').update(canonicalJson(structure)).digest('hex'),
    counts,
    structure
  }
}

async function readOnlySnapshot(connection, expectedDatabase) {
  await connection.query('START TRANSACTION READ ONLY')
  try {
    const identity = await getIdentity(connection)
    if (identity.database !== expectedDatabase) {
      throw new Error(`Connected database mismatch: expected ${expectedDatabase}, received ${identity.database}.`)
    }
    if (!/^8\./.test(identity.mysqlVersion)) {
      throw new Error(`MySQL 8 is required; connected server reports ${identity.mysqlVersion}.`)
    }
    const snapshot = await readSchemaSnapshot(connection)
    return { identity, ...snapshot }
  } finally {
    await connection.query('ROLLBACK')
  }
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message)
}

function validateLedgerState(version, migrations, ledgerRows) {
  const expectedPrevious = migrations.filter((migration) => migration.version < version)
  for (const migration of expectedPrevious) {
    const row = ledgerRows.find((entry) => entry.version === migration.version)
    requireValue(row?.status === 'APPLIED' && row.migration_name === migration.name
      && row.checksum === migration.checksum,
    `Migration ${migration.version} must be recorded APPLIED with its current checksum before ${version}.`)
  }
  requireValue(!ledgerRows.some((row) => row.version >= version),
    `Unexpected migration ledger state at version ${version}; stop for manual review.`)
}

async function tableExists(connection, table) {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  )
  return Number(row.found) === 1
}

async function getColumn(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  )
  return rows[0] || null
}

async function hasColumn(connection, table, column) {
  return Boolean(await getColumn(connection, table, column))
}

async function hasConstraint(connection, table, name, type) {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = ?`,
    [table, name, type]
  )
  return Number(row.found) > 0
}

async function hasUniqueIndex(connection, table, name) {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? AND NON_UNIQUE = 0`,
    [table, name]
  )
  return Number(row.found) > 0
}

async function hasIndex(connection, table, name) {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, name]
  )
  return Number(row.found) > 0
}

async function triggerExists(connection) {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'trg_oficializar_semaforo'`
  )
  return Number(row.found) > 0
}

async function viewDefinition(connection) {
  const [[row]] = await connection.query(
    `SELECT VIEW_DEFINITION FROM information_schema.VIEWS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'v_historico_veedurias'`
  )
  return row?.VIEW_DEFINITION || null
}

async function validateBaseline(connection, snapshot) {
  for (const table of BASE_TABLES) {
    requireValue(
      snapshot.structure.tables.some((row) =>
        row.TABLE_NAME === table && row.TABLE_TYPE === 'BASE TABLE' && row.ENGINE === 'InnoDB'),
      `${table} must exist as an InnoDB base table.`
    )
  }
  requireValue(snapshot.structure.views.some((row) => row.TABLE_NAME === 'v_historico_veedurias'),
    'Expected view v_historico_veedurias was not found.')
  requireValue(await triggerExists(connection), 'Expected trigger trg_oficializar_semaforo was not found.')
  requireValue(!(await getColumn(connection, 'reporte_veeduria', 'id_cmj_oficializa')),
    'D1 officialization columns already exist; do not run against this schema state.')
  requireValue(!(await getColumn(connection, 'reporte_veeduria', 'fecha_oficializacion')),
    'D1 officialization columns already exist; do not run against this schema state.')
  requireValue((await getColumn(connection, 'reporte_veeduria', 'id_reportante'))?.COLUMN_TYPE === 'int'
    && (await getColumn(connection, 'reporte_veeduria', 'id_reportante'))?.IS_NULLABLE === 'NO',
  'reporte_veeduria.id_reportante must be signed INT NOT NULL before migration 002.')
  requireValue((await getColumn(connection, 'reporte_veeduria', 'id_cmj_valida'))?.COLUMN_TYPE === 'int'
    && (await getColumn(connection, 'cmj_consejero', 'id_persona'))?.COLUMN_TYPE === 'int'
    && (await getColumn(connection, 'historial_estado_escenario', 'id_reporte'))?.COLUMN_TYPE === 'int',
  'D1 foreign-key and history columns must be signed INT.')
  requireValue(await hasConstraint(connection, 'reporte_veeduria', 'ck_reporte_validacion', 'CHECK'),
    'Existing validation CHECK ck_reporte_validacion was not found.')
  requireValue(!(await hasConstraint(connection, 'reporte_veeduria', 'fk_reporte_cmj_oficializa', 'FOREIGN KEY'))
    && !(await hasConstraint(connection, 'reporte_veeduria', 'ck_reporte_oficializacion', 'CHECK'))
    && !(await hasConstraint(connection, 'historial_estado_escenario',
      'uq_historial_reporte_oficializacion', 'UNIQUE'))
    && !(await hasIndex(connection, 'reporte_veeduria', 'ix_reporte_cmj_oficializa'))
    && !(await hasIndex(connection, 'historial_estado_escenario',
      'uq_historial_reporte_oficializacion')),
  'One or more D1 constraint/index names are already in use.')
  const [[duplicates]] = await connection.query(
    `SELECT COUNT(*) AS groups_found FROM (
       SELECT id_reporte FROM historial_estado_escenario
       WHERE id_reporte IS NOT NULL GROUP BY id_reporte HAVING COUNT(*) > 1
     ) AS duplicate_reports`
  )
  requireValue(Number(duplicates.groups_found) === 0, 'Duplicate history report ids prevent migration 001.')
  for (const table of REPORTAR_TABLES.concat('reporte_veeduria_historial')) {
    requireValue(!(await tableExists(connection, table)), `${table} already exists; inspect before migration.`)
  }
}

async function validateStage(connection, version, migrations, ledgerRows, manifest) {
  validateLedgerState(version, migrations, ledgerRows)

  if (version === '001') {
    await validateBaseline(connection, await readSchemaSnapshot(connection))
    return
  }

  for (const table of BASE_TABLES) {
    requireValue(await tableExists(connection, table), `${table} is missing before migration ${version}.`)
  }
  const officializer = await getColumn(connection, 'reporte_veeduria', 'id_cmj_oficializa')
  const officializedAt = await getColumn(connection, 'reporte_veeduria', 'fecha_oficializacion')
  requireValue(officializer?.COLUMN_TYPE === 'int' && officializer.IS_NULLABLE === 'YES'
    && officializedAt?.COLUMN_TYPE === 'datetime' && officializedAt.IS_NULLABLE === 'YES',
  'D1 officialization columns are missing or incompatible.')
  requireValue(!(await triggerExists(connection)), 'Automatic semáforo trigger remains after migration 001.')
  requireValue(await hasConstraint(connection, 'reporte_veeduria', 'fk_reporte_cmj_oficializa', 'FOREIGN KEY'),
    'D1 officializer foreign key is missing.')
  requireValue(await hasConstraint(connection, 'reporte_veeduria', 'ck_reporte_oficializacion', 'CHECK'),
    'D1 officialization CHECK is missing.')
  requireValue(await hasUniqueIndex(connection, 'historial_estado_escenario', 'uq_historial_reporte_oficializacion'),
    'D1 unique officialization history index is missing.')

  if (version === '002') {
    const reporterColumn = await getColumn(connection, 'reporte_veeduria', 'id_reportante')
    requireValue(reporterColumn?.COLUMN_TYPE === 'int' && reporterColumn.IS_NULLABLE === 'NO',
      'id_reportante must remain NOT NULL until migration 002.')
    for (const table of REPORTAR_TABLES) {
      requireValue(!(await tableExists(connection, table)), `${table} already exists before migration 002.`)
    }
    const actualView = await viewDefinition(connection)
    const baselineView = manifest.source.structure.views.find(
      (row) => row.TABLE_NAME === 'v_historico_veedurias'
    )?.VIEW_DEFINITION
    requireValue(actualView && actualView === baselineView,
      'v_historico_veedurias differs from its verified pre-migration definition.')
    requireValue(!(await tableExists(connection, 'reporte_veeduria_historial')),
      'reporte_veeduria_historial already exists before migration 003.')
    return
  }

  requireValue((await getColumn(connection, 'reporte_veeduria', 'id_reportante'))?.IS_NULLABLE === 'YES',
    'Migration 002 must make id_reportante nullable for snapshot-based public intake.')
  for (const table of REPORTAR_TABLES) {
    requireValue(await tableExists(connection, table), `${table} is missing after migration 002.`)
  }
  const definition = await viewDefinition(connection)
  requireValue(definition && /LEFT\s+JOIN\s+persona\s+pr/i.test(definition),
    'v_historico_veedurias was not replaced with the expected LEFT JOIN for legacy reports.')
  requireValue(!(await tableExists(connection, 'reporte_veeduria_historial')),
    'Decision history table already exists before migration 003.')
  requireValue((await getColumn(connection, 'reporte_veeduria', 'id_reporte'))?.COLUMN_TYPE === 'int'
    && (await getColumn(connection, 'reporte_veeduria', 'id_cmj_valida'))?.COLUMN_TYPE === 'int'
    && (await getColumn(connection, 'cmj_consejero', 'id_persona'))?.COLUMN_TYPE === 'int'
    && await hasColumn(connection, 'reporte_veeduria', 'estado_reporte'),
  '003 report/CMJ identifiers or report status are incompatible.')
}

async function validatePostflight(connection, version) {
  if (version === '001') {
    const officializer = await getColumn(connection, 'reporte_veeduria', 'id_cmj_oficializa')
    const officializedAt = await getColumn(connection, 'reporte_veeduria', 'fecha_oficializacion')
    requireValue(officializer?.COLUMN_TYPE === 'int' && officializedAt?.COLUMN_TYPE === 'datetime',
      '001 postflight failed: D1 columns are missing or incompatible.')
    requireValue(!(await triggerExists(connection)), '001 postflight failed: old automatic trigger remains.')
    requireValue(await hasConstraint(connection, 'reporte_veeduria', 'fk_reporte_cmj_oficializa', 'FOREIGN KEY')
      && await hasConstraint(connection, 'reporte_veeduria', 'ck_reporte_oficializacion', 'CHECK')
      && await hasIndex(connection, 'reporte_veeduria', 'ix_reporte_cmj_oficializa')
      && await hasUniqueIndex(connection, 'historial_estado_escenario', 'uq_historial_reporte_oficializacion'),
    '001 postflight failed: D1 constraints/index are incomplete.')
    return
  }
  if (version === '002') {
    requireValue((await getColumn(connection, 'reporte_veeduria', 'id_reportante'))?.IS_NULLABLE === 'YES',
      '002 postflight failed: id_reportante is not nullable.')
    for (const table of REPORTAR_TABLES) {
      requireValue(await tableExists(connection, table), `002 postflight failed: ${table} is missing.`)
      const [[engine]] = await connection.query(
        'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table]
      )
      requireValue(engine?.ENGINE === 'InnoDB', `002 postflight failed: ${table} is not InnoDB.`)
    }
    const requiredColumns = {
      solicitud_escenario: [
        'nombre_escenario', 'id_disciplina', 'zona', 'comuna', 'barrio',
        'corregimiento', 'localidad_rural', 'tipo_localidad', 'tipo_ubicacion',
        'latitud', 'longitud', 'estado_revision', 'id_cmj_revisa',
        'fecha_revision', 'observacion_cmj', 'id_escenario', 'fecha_solicitud'
      ],
      solicitud_escenario_historial: [
        'id_solicitud_escenario', 'estado_anterior', 'estado_nuevo',
        'id_cmj', 'observacion', 'fecha_evento'
      ],
      solicitud_veeduria: [
        'codigo_seguimiento_hash', 'nombre_contacto', 'correo_contacto',
        'id_escenario', 'id_solicitud_escenario', 'estado_propuesto',
        'descripcion', 'id_reporte', 'fecha_recepcion'
      ],
      evidencia_veeduria: [
        'id_solicitud_veeduria', 'orden', 'clave_objeto_privado', 'mime_real',
        'bytes_original', 'bytes_optimizada', 'ancho', 'alto', 'sha256',
        'exif_eliminado', 'fecha_registro'
      ]
    }
    for (const [table, columns] of Object.entries(requiredColumns)) {
      for (const column of columns) {
        requireValue(await hasColumn(connection, table, column),
          `002 postflight failed: ${table}.${column} is missing.`)
      }
    }
    const requiredConstraints = [
      ['solicitud_escenario', 'fk_solicitud_escenario_disciplina', 'FOREIGN KEY'],
      ['solicitud_escenario', 'fk_solicitud_escenario_cmj', 'FOREIGN KEY'],
      ['solicitud_escenario', 'fk_solicitud_escenario_inventario', 'FOREIGN KEY'],
      ['solicitud_escenario', 'ck_solicitud_escenario_territorio', 'CHECK'],
      ['solicitud_escenario', 'ck_solicitud_escenario_gps', 'CHECK'],
      ['solicitud_escenario', 'ck_solicitud_escenario_revision', 'CHECK'],
      ['solicitud_escenario_historial', 'fk_solicitud_escenario_historial_solicitud', 'FOREIGN KEY'],
      ['solicitud_escenario_historial', 'fk_solicitud_escenario_historial_cmj', 'FOREIGN KEY'],
      ['solicitud_escenario_historial', 'ck_solicitud_escenario_historial_actor', 'CHECK'],
      ['solicitud_veeduria', 'fk_solicitud_veeduria_escenario', 'FOREIGN KEY'],
      ['solicitud_veeduria', 'fk_solicitud_veeduria_propuesta', 'FOREIGN KEY'],
      ['solicitud_veeduria', 'fk_solicitud_veeduria_reporte', 'FOREIGN KEY'],
      ['solicitud_veeduria', 'ck_solicitud_veeduria_destino', 'CHECK'],
      ['evidencia_veeduria', 'fk_evidencia_solicitud', 'FOREIGN KEY'],
      ['evidencia_veeduria', 'ck_evidencia_orden', 'CHECK'],
      ['evidencia_veeduria', 'ck_evidencia_bytes', 'CHECK'],
      ['evidencia_veeduria', 'ck_evidencia_optimizacion', 'CHECK'],
      ['evidencia_veeduria', 'ck_evidencia_dimensiones', 'CHECK'],
      ['evidencia_veeduria', 'ck_evidencia_exif', 'CHECK']
    ]
    for (const [table, name, type] of requiredConstraints) {
      requireValue(await hasConstraint(connection, table, name, type),
        `002 postflight failed: ${name} is missing.`)
    }
    for (const [table, name] of [
      ['solicitud_escenario', 'uq_solicitud_escenario_inventario'],
      ['solicitud_veeduria', 'uq_solicitud_veeduria_codigo'],
      ['solicitud_veeduria', 'uq_solicitud_veeduria_reporte'],
      ['evidencia_veeduria', 'uq_evidencia_clave_privada'],
      ['evidencia_veeduria', 'uq_evidencia_orden']
    ]) {
      requireValue(await hasUniqueIndex(connection, table, name),
        `002 postflight failed: unique index ${name} is missing.`)
    }
    for (const [table, name] of [
      ['solicitud_escenario', 'ix_solicitud_escenario_estado'],
      ['solicitud_escenario', 'ix_solicitud_escenario_disciplina'],
      ['solicitud_escenario', 'ix_solicitud_escenario_cmj'],
      ['solicitud_escenario_historial', 'ix_solicitud_escenario_historial'],
      ['solicitud_escenario_historial', 'ix_solicitud_escenario_historial_cmj'],
      ['solicitud_veeduria', 'ix_solicitud_veeduria_escenario'],
      ['solicitud_veeduria', 'ix_solicitud_veeduria_propuesta']
    ]) {
      requireValue(await hasIndex(connection, table, name),
        `002 postflight failed: index ${name} is missing.`)
    }
    const definition = await viewDefinition(connection) || ''
    requireValue(/LEFT\s+JOIN\s+persona\s+pr/i.test(definition)
      && /LEFT\s+JOIN\s+persona\s+pc/i.test(definition),
      '002 postflight failed: replacement view definition was not found.')
    return
  }
  if (version === '003') {
    requireValue(await tableExists(connection, 'reporte_veeduria_historial'),
      '003 postflight failed: report decision history table is missing.')
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_veeduria_historial'`
    )
    for (const name of [
      'id_historial_reporte', 'id_reporte', 'estado_anterior',
      'estado_nuevo', 'id_cmj', 'observacion', 'fecha_evento'
    ]) {
      requireValue(columns.some((column) => column.COLUMN_NAME === name),
        `003 postflight failed: ${name} column is missing.`)
    }
    requireValue(await hasConstraint(connection, 'reporte_veeduria_historial',
      'fk_reporte_veeduria_historial_reporte', 'FOREIGN KEY')
      && await hasConstraint(connection, 'reporte_veeduria_historial',
        'fk_reporte_veeduria_historial_cmj', 'FOREIGN KEY')
      && await hasConstraint(connection, 'reporte_veeduria_historial',
        'ck_reporte_veeduria_historial_actor', 'CHECK'),
    '003 postflight failed: history constraints are incomplete.')
    requireValue(await hasIndex(connection, 'reporte_veeduria_historial',
      'ix_reporte_veeduria_historial')
      && await hasIndex(connection, 'reporte_veeduria_historial',
        'ix_reporte_veeduria_historial_cmj'),
    '003 postflight failed: history lookup indexes are missing.')
    const [[table]] = await connection.query(
      `SELECT ENGINE FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_veeduria_historial'`
    )
    requireValue(table?.ENGINE === 'InnoDB', '003 postflight failed: history table is not InnoDB.')
  }
}

async function verifyTargetIdentity(connection, expectedDatabase, manifest) {
  const identity = await getIdentity(connection)
  requireValue(identity.database === expectedDatabase,
    `Connected database mismatch: expected ${expectedDatabase}, got ${identity.database}.`)
  requireValue(/^8\./.test(identity.mysqlVersion), `MySQL 8 is required; got ${identity.mysqlVersion}.`)
  if (manifest) {
    const expected = manifest.source
    requireValue(identity.serverHostname === expected.serverHostname
      && identity.serverPort === expected.serverPort
      && identity.configuredHost === expected.configuredHost
      && identity.configuredPort === expected.configuredPort
      && identity.mysqlVersion === expected.mysqlVersion,
    'Current MySQL host, port, or version differs from the signed backup manifest.')
  }
  return identity
}

function assertBaselineCounts(current, baseline) {
  for (const [table, count] of Object.entries(baseline)) {
    requireValue(current[table] === count,
      `Baseline row count changed for ${table}: expected ${count}, got ${current[table]}. Pause writes and review before continuing.`)
  }
}

module.exports = {
  assertBaselineCounts,
  createConnection,
  getIdentity,
  readOnlySnapshot,
  readSchemaSnapshot,
  validateLedgerState,
  validatePostflight,
  validateStage,
  verifyTargetIdentity
}
