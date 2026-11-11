const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const SAFE_DATABASE = /^sivec_(?:restore_test|migration_test|isolated)_[a-z0-9_]+$/
const ORIGINAL_DATABASE = 'deportes'
const RESTORE_DATABASE = /^sivec_restore_test_[a-z0-9_]+$/
const ORIGINAL_MIGRATIONS = [
  { version: '001', name: '001_d1_independent_officialization.js', checksum: 'a2d81f10b96dbde358ed13c1d5efcd748b19a27986e1954d05c5b60c9770305a' },
  { version: '002', name: '002_reportar_intake_and_evidence.js', checksum: 'afa336878261af47a9553d1dc9b22600578b1af0126a3661c1904bd5b3f65aa1' },
  { version: '003', name: '003_report_decision_history.js', checksum: '8c586a9cdc69933ee91bd45782bea13cd0d776947c40e73333a44f2f3d0e3845' }
]
const CORE_TABLES = [
  'escenario',
  'historial_estado_escenario',
  'reporte_veeduria',
  'cmj_consejero',
  'persona'
]

function assertSafeDatabase(database) {
  if (!SAFE_DATABASE.test(database || '')) {
    throw new Error(
      'Migration execution is restricted to explicitly named SIVEC isolated/test databases.'
    )
  }
}

function parseArguments(argv) {
  const options = {
    status: false,
    help: false,
    database: null,
    allowOriginalDeportes: false,
    confirmTarget: null,
    backupManifest: null,
    preflightOnly: false
  }
  const seen = new Set()
  for (const argument of argv) {
    const key = argument.split('=')[0]
    if (seen.has(key)) throw new Error(`Duplicate argument: ${key}`)
    seen.add(key)
    if (argument === '--status') options.status = true
    else if (argument === '--help' || argument === '-h') options.help = true
    else if (argument === '--allow-original-deportes') options.allowOriginalDeportes = true
    else if (argument === '--preflight-only') options.preflightOnly = true
    else if (argument.startsWith('--database=')) options.database = argument.slice('--database='.length)
    else if (argument.startsWith('--confirm-target=')) options.confirmTarget = argument.slice('--confirm-target='.length)
    else if (argument.startsWith('--backup-manifest=')) options.backupManifest = argument.slice('--backup-manifest='.length)
    else throw new Error(`Unknown argument: ${argument}`)
  }
  return options
}

function assertTargetAuthorization(options) {
  if (options.database === ORIGINAL_DATABASE) {
    if (!options.allowOriginalDeportes || options.confirmTarget !== ORIGINAL_DATABASE) {
      throw new Error(
        'The deportes target requires --database=deportes --allow-original-deportes --confirm-target=deportes.'
      )
    }
    if (!options.backupManifest) {
      throw new Error('The deportes target requires --backup-manifest=<signed-manifest-path>.')
    }
    if (options.status) throw new Error('Use --preflight-only instead of --status for deportes.')
    return 'original'
  }

  if (options.allowOriginalDeportes || options.confirmTarget || options.backupManifest || options.preflightOnly) {
    throw new Error('Original-deportes authorization and preflight flags cannot be used with isolated databases.')
  }
  if (!options.database) throw new Error('Specify an explicit isolated database with --database.')
  assertSafeDatabase(options.database)
  return 'isolated'
}

function assertOriginalMigrationSequence(migrations) {
  if (migrations.length !== ORIGINAL_MIGRATIONS.length
      || migrations.some((migration, index) => {
        const approved = ORIGINAL_MIGRATIONS[index]
        return migration.version !== approved.version
          || migration.name !== approved.name
          || migration.checksum !== approved.checksum
      })) {
    throw new Error('Original database execution requires the approved, checksum-pinned migrations 001, 002, and 003 in order.')
  }
}

function getManifestKey(value = process.env.SIVEC_BACKUP_MANIFEST_KEY) {
  if (!value || Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error('SIVEC_BACKUP_MANIFEST_KEY must contain at least 32 UTF-8 bytes.')
  }
  return value
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function signManifest(manifest, key = getManifestKey()) {
  return crypto.createHmac('sha256', key).update(canonicalJson(manifest)).digest('hex')
}

function verifyManifestSignature(envelope, key = getManifestKey()) {
  if (!envelope || envelope.format !== 'sivec-backup-manifest-v1'
      || !envelope.manifest || !/^[a-f0-9]{64}$/.test(envelope.hmac || '')) {
    throw new Error('Backup manifest format or HMAC is invalid.')
  }
  const expected = Buffer.from(signManifest(envelope.manifest, key), 'hex')
  const received = Buffer.from(envelope.hmac, 'hex')
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw new Error('Backup manifest HMAC verification failed.')
  }
  return envelope.manifest
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

function hashStructure(structure) {
  return crypto.createHash('sha256').update(canonicalJson(structure)).digest('hex')
}

function assertManifestShape(manifest, manifestPath) {
  if (manifest.sourceDatabase !== ORIGINAL_DATABASE
      || !RESTORE_DATABASE.test(manifest.restoredDatabase || '')
      || !manifest.backup || !manifest.restoreEvidence
      || !manifest.source || !manifest.restored
      || !Number.isFinite(Date.parse(manifest.createdAt))) {
    throw new Error('Backup manifest is missing required source, restore, backup, or evidence fields.')
  }
  if (!path.isAbsolute(manifest.backup.path || '')
      || !path.isAbsolute(manifest.restoreEvidence.path || '')) {
    throw new Error('Backup and restoration-evidence paths in the manifest must be absolute.')
  }
  const backupPath = fs.realpathSync(manifest.backup.path)
  const evidencePath = fs.realpathSync(manifest.restoreEvidence.path)
  if (backupPath === evidencePath || backupPath === fs.realpathSync(manifestPath)
      || evidencePath === fs.realpathSync(manifestPath)) {
    throw new Error('Manifest, backup, and restoration-evidence files must be separate files.')
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.backup.sha256 || '')
      || !/^[a-f0-9]{64}$/.test(manifest.restoreEvidence.sha256 || '')
      || !/^[a-f0-9]{64}$/.test(manifest.source.schemaSha256 || '')
      || !/^[a-f0-9]{64}$/.test(manifest.restored.schemaSha256 || '')
      || !manifest.source.structure || !manifest.restored.structure
      || hashStructure(manifest.source.structure) !== manifest.source.schemaSha256
      || hashStructure(manifest.restored.structure) !== manifest.restored.schemaSha256) {
    throw new Error('Backup manifest contains an invalid SHA-256 value.')
  }
  const validCounts = (counts) => counts && typeof counts === 'object'
    && !Array.isArray(counts)
    && CORE_TABLES.every((table) => Number.isSafeInteger(counts[table]) && counts[table] >= 0)
    && Object.values(counts).every((count) => Number.isSafeInteger(count) && count >= 0)
  if (manifest.source.database !== ORIGINAL_DATABASE
      || manifest.restored.database !== manifest.restoredDatabase
      || !/^8\./.test(manifest.source.mysqlVersion || '')
      || manifest.restored.mysqlVersion !== manifest.source.mysqlVersion
      || !manifest.source.serverHostname
      || manifest.restored.serverHostname !== manifest.source.serverHostname
      || !Number.isInteger(manifest.source.serverPort)
      || manifest.restored.serverPort !== manifest.source.serverPort
      || !manifest.source.configuredHost
      || !Number.isInteger(manifest.source.configuredPort)
      || !validCounts(manifest.source.counts)
      || !validCounts(manifest.restored.counts)) {
    throw new Error('Backup manifest has invalid database identity, version, or row-count data.')
  }
  if (manifest.source.schemaSha256 !== manifest.restored.schemaSha256
      || canonicalJson(manifest.source.counts) !== canonicalJson(manifest.restored.counts)) {
    throw new Error('The restored isolated database does not match the source structures and counts.')
  }
  return { backupPath, evidencePath }
}

async function assertBackupFiles(manifest, manifestPath) {
  const { backupPath, evidencePath } = assertManifestShape(manifest, manifestPath)
  if (await hashFile(backupPath) !== manifest.backup.sha256) {
    throw new Error('Backup file SHA-256 does not match the signed manifest.')
  }
  if (await hashFile(evidencePath) !== manifest.restoreEvidence.sha256) {
    throw new Error('Restore evidence SHA-256 does not match the signed manifest.')
  }
  const evidence = fs.readFileSync(evidencePath, 'utf8')
  if (!evidence.includes(`RESTORE SUCCESS: ${manifest.restoredDatabase}`)) {
    throw new Error('Restore evidence must contain the exact RESTORE SUCCESS marker and isolated database name.')
  }
  return { backupPath, evidencePath }
}

module.exports = {
  CORE_TABLES,
  ORIGINAL_DATABASE,
  ORIGINAL_MIGRATIONS,
  RESTORE_DATABASE,
  assertBackupFiles,
  assertManifestShape,
  assertOriginalMigrationSequence,
  assertSafeDatabase,
  assertTargetAuthorization,
  canonicalJson,
  getManifestKey,
  hashFile,
  hashStructure,
  parseArguments,
  signManifest,
  verifyManifestSignature
}
