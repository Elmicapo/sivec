const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })
const {
  assertBackupFiles,
  canonicalJson,
  assertOriginalMigrationSequence,
  assertSafeDatabase,
  assertTargetAuthorization,
  parseArguments,
  verifyManifestSignature
} = require('./migration-safety')
const {
  assertBaselineCounts,
  createConnection,
  readSchemaSnapshot,
  readOnlySnapshot,
  validatePostflight,
  validateStage,
  verifyTargetIdentity
} = require('./migration-preflight')

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations')

function loadMigrations(directory = MIGRATIONS_DIR) {
  const files = fs.readdirSync(directory)
    .filter((name) => /^\d{3,}_[a-z0-9_]+\.js$/.test(name))
    .sort()

  const versions = new Set()
  return files.map((name) => {
    const version = name.slice(0, name.indexOf('_'))
    if (versions.has(version)) throw new Error(`Duplicate migration version: ${version}`)
    versions.add(version)

    const filePath = path.join(directory, name)
    const migration = require(filePath)
    if (typeof migration.up !== 'function') {
      throw new Error(`Migration ${name} must export an up(connection) function.`)
    }

    const bytes = fs.readFileSync(filePath)
    const lf = bytes.toString('utf8').replace(/\r\n/g, '\n')
    const crlf = lf.replace(/\n/g, '\r\n')
    const hash = (content) => crypto.createHash('sha256').update(content).digest('hex')
    const checksum = hash(bytes)
    const lineEndingChecksums = Buffer.from(bytes.toString('utf8')).equals(bytes)
      && (bytes.equals(Buffer.from(lf)) || bytes.equals(Buffer.from(crlf)))
      ? [hash(lf), hash(crlf)]
      : []

    return {
      version,
      name,
      checksum,
      lineEndingChecksums,
      up: migration.up
    }
  })
}

function selectMigrationsForTarget(targetMode, migrations) {
  if (targetMode !== 'original') return migrations
  return migrations.filter((migration) => ['001', '002', '003'].includes(migration.version))
}

function migrationLockName(database) {
  const suffix = crypto.createHash('sha256').update(database).digest('hex').slice(0, 40)
  return `sivec_migrations_${suffix}`
}

async function runMigrationsInternal(
  connection,
  database,
  migrations,
  log = () => {},
  { beforeMigration, afterMigration, beforeLedger, allowOriginal = false } = {}
) {
  if (!allowOriginal || database !== 'deportes') assertSafeDatabase(database)
  const lockName = migrationLockName(database)
  const [lockRows] = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [lockName])
  if (Number(lockRows[0]?.acquired) !== 1) {
    throw new Error(`Another migration executor holds the lock for ${database}.`)
  }

  try {
    if (beforeLedger) await beforeLedger()
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sivec_schema_migrations (
        version VARCHAR(20) NOT NULL,
        migration_name VARCHAR(255) NOT NULL,
        checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        status ENUM('RUNNING', 'APPLIED', 'FAILED') NOT NULL,
        started_at DATETIME NOT NULL,
        finished_at DATETIME NULL,
        error_message VARCHAR(1000) NULL,
        PRIMARY KEY (version),
        UNIQUE KEY uq_sivec_migration_name (migration_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    const [existingRows] = await connection.query(
      'SELECT version, migration_name, checksum, status FROM sivec_schema_migrations ORDER BY version'
    )
    const existing = new Map(existingRows.map((row) => [row.version, row]))
    const latestVersion = migrations.length ? migrations[migrations.length - 1].version : null
    for (const row of existingRows) {
      if (!migrations.some((migration) => migration.version === row.version)) {
        throw new Error(`Database has migration ${row.version}, but its file is missing.`)
      }
    }

    for (const migration of migrations) {
      if (beforeMigration) await beforeMigration(migration, existingRows)
      const applied = existing.get(migration.version)
      if (applied) {
        const checksumMatches = applied.checksum === migration.checksum
          || (!allowOriginal && migration.lineEndingChecksums?.includes(applied.checksum))
        if (applied.migration_name !== migration.name || !checksumMatches) {
          throw new Error(`Migration ${migration.version} has changed since it was recorded.`)
        }
        if (applied.status === 'APPLIED') {
          log(`Already applied ${migration.version} ${migration.name}`)
          continue
        }
        throw new Error(
          `Migration ${migration.version} is ${applied.status}; inspect and repair the isolated database before retrying.`
        )
      }

      const laterRecorded = existingRows.find((row) => row.version > migration.version)
      if (laterRecorded) {
        throw new Error(
          `Migration order is inconsistent: ${laterRecorded.version} is recorded before ${migration.version}.`
        )
      }

      await connection.query(
        `INSERT INTO sivec_schema_migrations
          (version, migration_name, checksum, status, started_at)
         VALUES (?, ?, ?, 'RUNNING', UTC_TIMESTAMP())`,
        [migration.version, migration.name, migration.checksum]
      )

      try {
        await migration.up(connection)
        if (afterMigration) await afterMigration(migration)
        await connection.query(
          `UPDATE sivec_schema_migrations
           SET status = 'APPLIED', finished_at = UTC_TIMESTAMP(), error_message = NULL
           WHERE version = ? AND status = 'RUNNING'`,
          [migration.version]
        )
        existing.set(migration.version, {
          version: migration.version,
          migration_name: migration.name,
          checksum: migration.checksum,
          status: 'APPLIED'
        })
        log(`Applied ${migration.version} ${migration.name}`)
      } catch (error) {
        const detail = `${error.code || 'MIGRATION_ERROR'}: ${error.message}`.slice(0, 1000)
        log(`Migration ${migration.version} FAILED: ${detail}`)
        try {
          await connection.query(
            `UPDATE sivec_schema_migrations
             SET status = 'FAILED', finished_at = UTC_TIMESTAMP(), error_message = ?
             WHERE version = ? AND status = 'RUNNING'`,
            [detail, migration.version]
          )
        } catch (ledgerError) {
          throw new Error(
            `Migration ${migration.version} failed: ${detail}. The FAILED state could not be recorded: ${ledgerError.message}. Later migrations were not run; do not retry before manual inspection.`
          )
        }
        throw new Error(
          `Migration ${migration.version} failed: ${detail}. Later migrations were not run; MySQL DDL may be partial. Restore from the verified backup only through a separately approved recovery procedure.`
        )
      }
    }

    return latestVersion
  } finally {
    await connection.query('SELECT RELEASE_LOCK(?)', [lockName])
  }
}

async function runMigrations(connection, database, migrations, log = () => {}) {
  return runMigrationsInternal(connection, database, migrations, log)
}

async function showStatus(connection, database) {
  assertSafeDatabase(database)
  const [tables] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sivec_schema_migrations'`
  )
  if (!Number(tables[0]?.found)) {
    console.log(`No migration history in ${database}.`)
    return
  }
  const [rows] = await connection.query(
    `SELECT version, migration_name, status, started_at, finished_at, error_message
     FROM sivec_schema_migrations ORDER BY version`
  )
  console.table(rows)
}

function loadBackupManifest(manifestPath) {
  const resolvedPath = path.resolve(manifestPath)
  const envelope = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
  const manifest = verifyManifestSignature(envelope)
  return { manifest, path: resolvedPath }
}

async function verifyBackupAndTarget(connection, manifestInfo, migrations, version, { ledgerCreated = false } = {}) {
  const { manifest, path: manifestPath } = manifestInfo
  await assertBackupFiles(manifest, manifestPath)
  const targetIdentity = await verifyTargetIdentity(connection, 'deportes', manifest)
  const restoredConnection = await createConnection(manifest.restoredDatabase)
  try {
    const restored = await readOnlySnapshot(restoredConnection, manifest.restoredDatabase)
    if (restored.schemaSha256 !== manifest.restored.schemaSha256
        || canonicalJson(restored.counts) !== canonicalJson(manifest.restored.counts)) {
      throw new Error('The isolated restore no longer matches the signed backup manifest.')
    }
    if (restored.identity.mysqlVersion !== targetIdentity.mysqlVersion
        || restored.identity.serverHostname !== targetIdentity.serverHostname
        || restored.identity.serverPort !== targetIdentity.serverPort) {
      throw new Error('The isolated restore and deportes are not on the same recorded MySQL server/version.')
    }
  } finally {
    await restoredConnection.end()
  }

  await connection.query('START TRANSACTION READ ONLY')
  try {
    const identity = await verifyTargetIdentity(connection, 'deportes', manifest)
    const snapshot = await readSchemaSnapshot(connection)
    if (version === '001' && !ledgerCreated && (snapshot.schemaSha256 !== manifest.source.schemaSha256
        || canonicalJson(snapshot.counts) !== canonicalJson(manifest.source.counts))) {
      throw new Error('deportes no longer matches the verified pre-migration schema and counts.')
    }
    if (version !== '001' || ledgerCreated) {
      assertBaselineCounts(snapshot.counts, manifest.source.counts)
    }
    const [ledgerTable] = await connection.query(
      `SELECT COUNT(*) AS found FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sivec_schema_migrations'`
    )
    let ledgerRows = []
    if (Number(ledgerTable[0].found)) {
      const [rows] = await connection.query(
        'SELECT version, migration_name, checksum, status FROM sivec_schema_migrations ORDER BY version'
      )
      ledgerRows = rows
    }
    await validateStage(connection, version, migrations, ledgerRows, manifest)
    return { targetIdentity: identity, snapshot, ledgerRows }
  } finally {
    await connection.query('ROLLBACK')
  }
}

async function preflightOriginal(connection, manifestInfo, migrations) {
  assertOriginalMigrationSequence(migrations)
  const firstMigration = migrations[0]
  const checked = await verifyBackupAndTarget(connection, manifestInfo, migrations, firstMigration.version)
  const trigger = checked.snapshot.structure.triggers.find(
    (row) => row.TRIGGER_NAME === 'trg_oficializar_semaforo'
  )
  const view = checked.snapshot.structure.views.find(
    (row) => row.TABLE_NAME === 'v_historico_veedurias'
  )
  console.log('READ-ONLY PREFLIGHT PASSED')
  console.log(`Target: ${checked.targetIdentity.database} at ${checked.targetIdentity.serverHostname}:${checked.targetIdentity.serverPort}, MySQL ${checked.targetIdentity.mysqlVersion}`)
  console.log('Migration state: 001, 002, and 003 pending in required order.')
  console.log(`Schema SHA-256: ${checked.snapshot.schemaSha256}`)
  console.log('Relevant table counts:', JSON.stringify(checked.snapshot.counts))
  console.log('Current trg_oficializar_semaforo definition:', trigger?.ACTION_STATEMENT || 'NOT FOUND')
  console.log('Current v_historico_veedurias definition:', view?.VIEW_DEFINITION || 'NOT FOUND')
  console.log(`Backup SHA-256 and signed restore evidence verified for isolated copy ${manifestInfo.manifest.restoredDatabase}.`)
}

async function runOriginalMigrations(connection, manifestInfo, migrations, log = console.log) {
  assertOriginalMigrationSequence(migrations)
  await preflightOriginal(connection, manifestInfo, migrations)
  const result = await runMigrationsInternal(connection, 'deportes', migrations, log, {
    allowOriginal: true,
    beforeLedger: async () => {
      await verifyBackupAndTarget(connection, manifestInfo, migrations, '001')
      log('Target and verified backup rechecked before creating the migration ledger.')
    },
    beforeMigration: async (migration) => {
      await verifyBackupAndTarget(connection, manifestInfo, migrations, migration.version, {
        ledgerCreated: true
      })
      log(`Target, backup, migration state, and preflight rechecked before ${migration.version}.`)
    },
    afterMigration: async (migration) => {
      await validatePostflight(connection, migration.version)
      log(`Postflight passed for ${migration.version}.`)
    }
  })
  await connection.query('START TRANSACTION READ ONLY')
  try {
    const snapshot = await readSchemaSnapshot(connection)
    assertBaselineCounts(snapshot.counts, manifestInfo.manifest.source.counts)
    const [rows] = await connection.query(
      'SELECT version, migration_name, checksum, status FROM sivec_schema_migrations ORDER BY version'
    )
    if (rows.length !== 3 || rows.some((row, index) =>
      row.version !== migrations[index].version
      || row.migration_name !== migrations[index].name
      || row.checksum !== migrations[index].checksum
      || row.status !== 'APPLIED')) {
      throw new Error('Final migration ledger verification failed; stop and inspect before application use.')
    }
    console.log('Final ledger verified: migrations 001, 002, and 003 are APPLIED with matching checksums.')
  } finally {
    await connection.query('ROLLBACK')
  }
  return result
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    console.log('Usage: node scripts/migrate.js --database=sivec_restore_test_<suffix> [--status]')
    console.log('       node scripts/migrate.js --database=deportes --allow-original-deportes --confirm-target=deportes --backup-manifest=<path> --preflight-only')
    console.log('       (remove --preflight-only only after reviewing the verified preflight output)')
    return
  }
  const targetMode = assertTargetAuthorization(options)
  const migrations = selectMigrationsForTarget(targetMode, loadMigrations())
  const manifestInfo = targetMode === 'original'
    ? loadBackupManifest(options.backupManifest)
    : null
  if (manifestInfo) {
    await assertBackupFiles(manifestInfo.manifest, manifestInfo.path)
  }

  const connection = await createConnection(options.database)

  try {
    if (targetMode === 'original') {
      if (options.preflightOnly) {
        await preflightOriginal(connection, manifestInfo, migrations)
        return
      }
      await runOriginalMigrations(connection, manifestInfo, migrations)
    } else {
      const target = await verifyTargetIdentity(connection, options.database)
      console.log(`Target confirmed: ${target.database} on MySQL ${target.mysqlVersion}`)
      if (options.status) await showStatus(connection, options.database)
      else await runMigrations(connection, options.database, migrations, console.log)
    }
  } finally {
    await connection.end()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}

module.exports = {
  assertSafeDatabase,
  loadMigrations,
  migrationLockName,
  parseArguments,
  selectMigrationsForTarget,
  runMigrations
}
