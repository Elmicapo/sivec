const test = require('node:test')
const assert = require('node:assert/strict')
const migration = require('./003_report_decision_history')

class FakeConnection {
  constructor(options = {}) {
    this.options = options
    this.queries = []
    this.created = false
  }

  async query(sql, values = []) {
    this.queries.push({ sql, values })
    if (sql.includes('SELECT VERSION()')) return [[{ mysql_version: '8.0.45' }]]
    if (sql.includes("SELECT ENGINE FROM information_schema.TABLES")) {
      if (this.options.missingTable && this.options.missingTable === values[0]) return [[]]
      return [[{ ENGINE: this.created ? 'InnoDB' : 'InnoDB' }]]
    }
    if (sql.includes("SELECT TABLE_NAME FROM information_schema.TABLES")
        && sql.includes("TABLE_NAME = 'reporte_veeduria_historial'")) {
      return [this.options.existingHistory ? [{ TABLE_NAME: 'reporte_veeduria_historial' }] : []]
    }
    if (sql.includes('FROM information_schema.COLUMNS')) {
      return [[
        { TABLE_NAME: 'reporte_veeduria', COLUMN_NAME: 'id_reporte', COLUMN_TYPE: 'int' },
        { TABLE_NAME: 'reporte_veeduria', COLUMN_NAME: 'estado_reporte', COLUMN_TYPE: "enum('PENDIENTE','VALIDADO','RECHAZADO')" },
        { TABLE_NAME: 'reporte_veeduria', COLUMN_NAME: 'id_cmj_valida', COLUMN_TYPE: 'int' },
        { TABLE_NAME: 'cmj_consejero', COLUMN_NAME: 'id_persona', COLUMN_TYPE: 'int' }
      ]]
    }
    if (sql.includes('CREATE TABLE reporte_veeduria_historial')) {
      this.created = true
      return [{ affectedRows: 0 }]
    }
    return [{ affectedRows: 0 }]
  }
}

test('migration creates only the InnoDB decision-history table after required preflight', async () => {
  const connection = new FakeConnection()
  await migration.up(connection)

  const create = connection.queries.find(({ sql }) => sql.includes('CREATE TABLE reporte_veeduria_historial'))
  assert.ok(create)
  assert.match(create.sql, /ENGINE=InnoDB/)
  assert.match(create.sql, /FOREIGN KEY \(id_reporte\)/)
  assert.match(create.sql, /FOREIGN KEY \(id_cmj\)/)
  assert.equal(connection.queries.some(({ sql }) => /\bDROP\b|\bALTER\b/i.test(sql)), false)
});

test('migration stops when the decision-history table already exists', async () => {
  const connection = new FakeConnection({ existingHistory: true })
  await assert.rejects(migration.up(connection), /already exists/)
  assert.equal(connection.queries.some(({ sql }) => sql.includes('CREATE TABLE reporte_veeduria_historial')), false)
});

test('migration stops when a required source table is missing', async () => {
  const connection = new FakeConnection({ missingTable: 'cmj_consejero' })
  await assert.rejects(migration.up(connection), /cmj_consejero must exist as InnoDB/)
  assert.equal(connection.queries.some(({ sql }) => sql.includes('CREATE TABLE reporte_veeduria_historial')), false)
});
