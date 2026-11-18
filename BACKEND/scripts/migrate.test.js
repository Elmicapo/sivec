const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const os = require('node:os')
const path = require('node:path')
const {
  assertSafeDatabase,
  loadMigrations,
  migrationLockName,
  parseArguments,
  selectMigrationsForTarget,
  runMigrations
} = require('./migrate')
const {
  assertBackupFiles,
  assertOriginalMigrationSequence,
  assertTargetAuthorization,
  hashFile,
  hashStructure,
  signManifest,
  verifyManifestSignature
} = require('./migration-safety')
const {
  readOnlySnapshot,
  validateLedgerState,
  verifyTargetIdentity
} = require('./migration-preflight')
const { parseArguments: parseBackupArguments } = require('./prepare-deportes-backup-manifest')

class FakeConnection {
  constructor(rows = []) {
    this.rows = rows
    this.queries = []
  }

  async query(sql, values = []) {
    this.queries.push({ sql, values })
    if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]]
    if (sql.includes('RELEASE_LOCK')) return [[{ released: 1 }]]
    if (sql.includes('SELECT version, migration_name, checksum, status')) return [this.rows]
    if (sql.includes('INSERT INTO sivec_schema_migrations')) {
      this.rows.push({
        version: values[0],
        migration_name: values[1],
        checksum: values[2],
        status: 'RUNNING'
      })
      return [{ affectedRows: 1 }]
    }
    if (sql.includes("SET status = 'APPLIED'")) {
      const row = this.rows.find((entry) => entry.version === values[0])
      row.status = 'APPLIED'
      return [{ affectedRows: 1 }]
    }
    if (sql.includes("SET status = 'FAILED'")) {
      const row = this.rows.find((entry) => entry.version === values[1])
      row.status = 'FAILED'
      return [{ affectedRows: 1 }]
    }
    return [{ affectedRows: 0 }]
  }
}

test('isolated target guard rejects the original and non-test databases', async () => {
  assert.doesNotThrow(() => assertSafeDatabase('sivec_restore_test_20261104_484fe0eb'))
  assert.throws(() => assertSafeDatabase('deportes'), /isolated\/test/)
  assert.throws(() => assertSafeDatabase('deportes_db'), /isolated\/test/)
  assert.throws(() => assertSafeDatabase('sivec_production'), /isolated\/test/)
  const connection = new FakeConnection()
  await assert.rejects(runMigrations(connection, 'deportes', []), /isolated\/test/)
  assert.equal(connection.queries.length, 0)
})

test('arguments require an explicit database and reject unknown options', () => {
  const options = parseArguments(['--database=sivec_migration_test_01', '--status'])
  assert.equal(options.database, 'sivec_migration_test_01')
  assert.equal(options.status, true)
  assert.equal(options.allowOriginalDeportes, false)
  assert.throws(() => parseArguments(['--drop']), /Unknown argument/)
  assert.throws(() => parseArguments(['--database=sivec_migration_test_01', '--database=sivec_isolated_02']), /Duplicate/)
})

test('only the exact opt-in combination authorizes deportes', () => {
  const authorized = parseArguments([
    '--database=deportes',
    '--allow-original-deportes',
    '--confirm-target=deportes',
    '--backup-manifest=C:\\backup\\manifest.json',
    '--preflight-only'
  ])
  assert.equal(assertTargetAuthorization(authorized), 'original')
  assert.throws(() => assertTargetAuthorization(parseArguments(['--database=deportes'])), /requires/)
  assert.throws(() => assertTargetAuthorization(parseArguments([
    '--database=deportes_db',
    '--allow-original-deportes',
    '--confirm-target=deportes',
    '--backup-manifest=C:\\backup\\manifest.json'
  ])), /cannot be used/)
  assert.throws(() => assertTargetAuthorization(parseArguments([
    '--database=sivec_isolated_01',
    '--allow-original-deportes'
  ])), /cannot be used/)
  assert.throws(() => assertTargetAuthorization(parseArguments([
    '--database=deportes',
    '--allow-original-deportes',
    '--confirm-target=deportes'
  ])), /backup-manifest/)
})

test('signed backup manifest binds file hash and restore evidence', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sivec-migration-test-'))
  const key = 'test-hmac-key-with-at-least-32-bytes'
  try {
    const backupPath = path.join(directory, 'backup.sql')
    const evidencePath = path.join(directory, 'restore.log')
    const manifestPath = path.join(directory, 'manifest.json')
    fs.writeFileSync(backupPath, 'backup bytes')
    fs.writeFileSync(evidencePath, 'RESTORE SUCCESS: sivec_restore_test_01\n')
    const structure = { tables: [] }
    const structureHash = hashStructure(structure)
    const manifest = {
      sourceDatabase: 'deportes',
      restoredDatabase: 'sivec_restore_test_01',
      createdAt: new Date().toISOString(),
      backup: { path: backupPath, sha256: await hashFile(backupPath) },
      restoreEvidence: { path: evidencePath, sha256: await hashFile(evidencePath) },
      source: {
        database: 'deportes',
        mysqlVersion: '8.0.45',
        serverHostname: 'db-host',
        serverPort: 3306,
        configuredHost: process.env.DB_HOST || 'localhost',
        configuredPort: Number(process.env.DB_PORT || 3306),
        schemaSha256: structureHash,
        counts: { escenario: 3, historial_estado_escenario: 2, reporte_veeduria: 3, cmj_consejero: 1, persona: 3 },
        structure
      },
      restored: {
        database: 'sivec_restore_test_01',
        mysqlVersion: '8.0.45',
        serverHostname: 'db-host',
        serverPort: 3306,
        schemaSha256: structureHash,
        counts: { escenario: 3, historial_estado_escenario: 2, reporte_veeduria: 3, cmj_consejero: 1, persona: 3 },
        structure
      }
    }
    const envelope = {
      format: 'sivec-backup-manifest-v1',
      manifest,
      hmac: signManifest(manifest, key)
    }
    fs.writeFileSync(manifestPath, JSON.stringify(envelope))
    assert.deepEqual(verifyManifestSignature(envelope, key), manifest)
    await assertBackupFiles(manifest, manifestPath)

    fs.writeFileSync(backupPath, 'modified backup bytes')
    await assert.rejects(assertBackupFiles(manifest, manifestPath), /SHA-256/)

    const tampered = { ...envelope, manifest: { ...manifest, restoredDatabase: 'sivec_isolated_01' } }
    assert.throws(() => verifyManifestSignature(tampered, key), /HMAC/)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('backup manifest preparation requires all restore evidence inputs', () => {
  assert.deepEqual(parseBackupArguments([
    '--restored-database=sivec_restore_test_01',
    '--backup-file=C:\\backup\\deportes.sql',
    '--restore-evidence=C:\\backup\\restore.log',
    '--manifest-out=C:\\backup\\manifest.json'
  ]), {
    'restored-database': 'sivec_restore_test_01',
    'backup-file': 'C:\\backup\\deportes.sql',
    'restore-evidence': 'C:\\backup\\restore.log',
    'manifest-out': 'C:\\backup\\manifest.json'
  })
  assert.throws(() => parseBackupArguments([
    '--restored-database=deportes',
    '--backup-file=C:\\backup\\deportes.sql',
    '--restore-evidence=C:\\backup\\restore.log',
    '--manifest-out=C:\\backup\\manifest.json'
  ]), /sivec_restore_test/)
})

test('original target identity rejects wrong database, server and MySQL version', async () => {
  const identity = {
    database_name: 'deportes',
    mysql_version: '8.0.45',
    server_hostname: 'db-host',
    server_port: 3306
  }
  const connection = { query: async () => [[identity]] }
  const manifest = {
    source: {
      serverHostname: 'db-host',
      serverPort: 3306,
      configuredHost: process.env.DB_HOST || 'localhost',
      configuredPort: Number(process.env.DB_PORT || 3306),
      mysqlVersion: '8.0.45'
    }
  }
  assert.equal((await verifyTargetIdentity(connection, 'deportes', manifest)).database, 'deportes')
  await assert.rejects(verifyTargetIdentity(connection, 'sivec_isolated_01', manifest), /database mismatch/)
  await assert.rejects(verifyTargetIdentity(connection, 'deportes', {
    source: { ...manifest.source, serverHostname: 'different-host' }
  }), /host, port, or version/)
  await assert.rejects(verifyTargetIdentity({
    query: async () => [[{ ...identity, mysql_version: '5.7.44' }]]
  }, 'deportes'), /MySQL 8/)
})

test('migration files are versioned, ordered, and checksummed', () => {
  const migrations = loadMigrations()
  assert.deepEqual(migrations.map((migration) => migration.version), ['001', '002', '003', '004', '005', '006', '007'])
  assert.deepEqual(
    selectMigrationsForTarget('original', migrations).map((migration) => migration.version),
    ['001', '002', '003']
  )
  assert.equal(selectMigrationsForTarget('isolated', migrations), migrations)
  assert.ok(migrations.every((migration) => /^[a-f0-9]{64}$/.test(migration.checksum)))
  // The approved original deployment files use CRLF. Keep the production byte check strict.
  const approvedMigrations = selectMigrationsForTarget('original', migrations).map((migration) => {
    const source = fs.readFileSync(path.join(__dirname, '../migrations', migration.name), 'utf8')
    const approvedBytes = source.replace(/\r?\n/g, '\r\n')
    return { ...migration, checksum: createHash('sha256').update(approvedBytes).digest('hex') }
  })
  assert.doesNotThrow(() => assertOriginalMigrationSequence(approvedMigrations))
  assert.throws(() => assertOriginalMigrationSequence(migrations), /checksum-pinned/)
  assert.throws(() => assertOriginalMigrationSequence(migrations.slice(1)), /checksum-pinned/)
  assert.throws(() => assertOriginalMigrationSequence([
    { ...approvedMigrations[0], checksum: '0'.repeat(64) },
    ...approvedMigrations.slice(1)
  ]), /checksum-pinned/)
  assert.match(migrationLockName('sivec_restore_test_01'), /^sivec_migrations_[a-f0-9]{40}$/)
})

test('preflight ledger checks enforce order, APPLIED state, and matching checksums', () => {
  const migrations = loadMigrations()
  assert.doesNotThrow(() => validateLedgerState('001', migrations, []))
  assert.doesNotThrow(() => validateLedgerState('002', migrations, [{
    version: '001',
    migration_name: migrations[0].name,
    checksum: migrations[0].checksum,
    status: 'APPLIED'
  }]))
  assert.throws(() => validateLedgerState('002', migrations, [{
    version: '001',
    migration_name: migrations[0].name,
    checksum: migrations[0].checksum,
    status: 'FAILED'
  }]), /must be recorded APPLIED/)
  assert.throws(() => validateLedgerState('001', migrations, [{
    version: '002',
    migration_name: migrations[1].name,
    checksum: migrations[1].checksum,
    status: 'APPLIED'
  }]), /Unexpected migration ledger state/)
})

test('read-only database snapshot opens and rolls back a READ ONLY transaction', async () => {
  const statements = []
  const connection = {
    async query(sql) {
      statements.push(sql)
      if (sql.includes('SELECT DATABASE()')) {
        return [[{
          database_name: 'deportes',
          mysql_version: '8.0.45',
          server_hostname: 'db-host',
          server_port: 3306
        }]]
      }
      return [[]]
    }
  }
  const result = await readOnlySnapshot(connection, 'deportes')
  assert.equal(result.identity.database, 'deportes')
  assert.ok(statements.includes('START TRANSACTION READ ONLY'))
  assert.ok(statements.includes('ROLLBACK'))
  assert.equal(statements.some((sql) => /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(sql)), false)
})

test('an applied migration with the same checksum is not executed again', async () => {
  const migration = {
    version: '001',
    name: '001_test.js',
    checksum: 'a'.repeat(64),
    up: async () => assert.fail('Applied migration must not run twice.')
  }
  const connection = new FakeConnection([{
    version: '001',
    migration_name: migration.name,
    checksum: migration.checksum,
    status: 'APPLIED'
  }])

  await runMigrations(connection, 'sivec_migration_test_01', [migration])
  assert.equal(connection.queries.filter(({ sql }) => sql.includes('INSERT INTO sivec_schema_migrations')).length, 0)
})

test('isolated migration accepts a CRLF ledger on Linux and rejects other byte changes', async () => {
  const [migration] = loadMigrations()
  const [lf, crlf] = migration.lineEndingChecksums
  assert.notEqual(lf, crlf)
  const row = {
    version: migration.version,
    migration_name: migration.name,
    checksum: crlf,
    status: 'APPLIED'
  }
  const current = { ...migration, checksum: lf, up: async () => assert.fail('Applied migration ran again.') }
  await runMigrations(new FakeConnection([row]), 'sivec_migration_test_01', [current])
  await assert.rejects(
    runMigrations(new FakeConnection([{ ...row, checksum: '0'.repeat(64) }]), 'sivec_migration_test_01', [current]),
    /has changed/
  )
})

test('a failed migration is recorded and stops later migrations', async () => {
  let secondMigrationRan = false
  const migrations = [
    {
      version: '001',
      name: '001_failure.js',
      checksum: 'b'.repeat(64),
      up: async () => { throw Object.assign(new Error('expected failure'), { code: 'TEST_FAILURE' }) }
    },
    {
      version: '002',
      name: '002_must_not_run.js',
      checksum: 'c'.repeat(64),
      up: async () => { secondMigrationRan = true }
    }
  ]
  const connection = new FakeConnection()

  await assert.rejects(
    runMigrations(connection, 'sivec_migration_test_01', migrations),
    /Later migrations were not run/
  )
  assert.equal(secondMigrationRan, false)
  assert.equal(connection.rows[0].status, 'FAILED')
  assert.ok(connection.queries.some(({ sql }) => sql.includes('RELEASE_LOCK')))
})
