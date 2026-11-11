const fs = require('node:fs')
const path = require('node:path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })
const {
  CORE_TABLES,
  RESTORE_DATABASE,
  canonicalJson,
  getManifestKey,
  hashFile,
  signManifest
} = require('./migration-safety')
const {
  createConnection,
  readOnlySnapshot
} = require('./migration-preflight')

function parseArguments(argv) {
  const options = {}
  for (const argument of argv) {
    const match = argument.match(/^--(restored-database|backup-file|restore-evidence|manifest-out)=(.+)$/)
    if (!match) throw new Error(`Unknown or incomplete argument: ${argument}`)
    if (options[match[1]]) throw new Error(`Duplicate argument: --${match[1]}`)
    options[match[1]] = match[2]
  }
  for (const required of ['restored-database', 'backup-file', 'restore-evidence', 'manifest-out']) {
    if (!options[required]) throw new Error(`Required argument missing: --${required}=...`)
  }
  if (!RESTORE_DATABASE.test(options['restored-database'])) {
    throw new Error('The restored copy must use an existing sivec_restore_test_<suffix> database.')
  }
  return options
}

async function prepareManifest(options) {
  getManifestKey()
  const backupPath = fs.realpathSync(options['backup-file'])
  const evidencePath = fs.realpathSync(options['restore-evidence'])
  const manifestPath = path.resolve(options['manifest-out'])
  if (new Set([backupPath, evidencePath, manifestPath]).size !== 3) {
    throw new Error('Backup, restore evidence, and output manifest must be separate files.')
  }
  const evidenceText = fs.readFileSync(evidencePath, 'utf8')
  const restoredDatabase = options['restored-database']
  if (!evidenceText.includes(`RESTORE SUCCESS: ${restoredDatabase}`)) {
    throw new Error(`Restore evidence must contain: RESTORE SUCCESS: ${restoredDatabase}`)
  }

  let sourceConnection
  let restoredConnection
  try {
    sourceConnection = await createConnection('deportes')
    restoredConnection = await createConnection(restoredDatabase)
    const source = await readOnlySnapshot(sourceConnection, 'deportes')
    const restored = await readOnlySnapshot(restoredConnection, restoredDatabase)
    for (const table of CORE_TABLES) {
      if (!Object.prototype.hasOwnProperty.call(source.counts, table)
          || !Object.prototype.hasOwnProperty.call(restored.counts, table)) {
        throw new Error(`Required comparison table ${table} is missing from source or restored copy.`)
      }
    }
    if (source.identity.mysqlVersion !== restored.identity.mysqlVersion
        || source.identity.serverHostname !== restored.identity.serverHostname
        || source.identity.serverPort !== restored.identity.serverPort
        || source.schemaSha256 !== restored.schemaSha256
        || canonicalJson(source.counts) !== canonicalJson(restored.counts)) {
      throw new Error('Restored database does not match deportes in MySQL host, version, schema, and exact table counts.')
    }

    const manifest = {
      sourceDatabase: 'deportes',
      restoredDatabase,
      createdAt: new Date().toISOString(),
      backup: { path: backupPath, sha256: await hashFile(backupPath) },
      restoreEvidence: { path: evidencePath, sha256: await hashFile(evidencePath) },
      source: {
        ...source.identity,
        schemaSha256: source.schemaSha256,
        counts: source.counts,
        structure: source.structure
      },
      restored: {
        ...restored.identity,
        schemaSha256: restored.schemaSha256,
        counts: restored.counts,
        structure: restored.structure
      }
    }
    const envelope = {
      format: 'sivec-backup-manifest-v1',
      manifest,
      hmac: signManifest(manifest)
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(envelope, null, 2)}\n`, { flag: 'wx' })
    return manifestPath
  } finally {
    await Promise.all([
      sourceConnection?.end(),
      restoredConnection?.end()
    ].filter(Boolean))
  }
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2))
    prepareManifest(options)
      .then((manifestPath) => console.log(`Signed backup manifest created: ${manifestPath}`))
      .catch((error) => {
        console.error(error.message)
        process.exitCode = 1
      })
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = { parseArguments, prepareManifest }
