async function up(connection) {
  const [[database]] = await connection.query('SELECT DATABASE() AS name')
  if (!/^sivec_(?:restore_test|migration_test|isolated)_[a-z0-9_]+$/.test(database.name || '')) {
    throw new Error('The GPS proposal migration requires an isolated SIVEC database.')
  }

  await connection.query(`
    ALTER TABLE solicitud_escenario
      DROP CHECK ck_solicitud_escenario_territorio,
      MODIFY COLUMN zona ENUM('URBANA', 'RURAL') NULL,
      ADD CONSTRAINT ck_solicitud_escenario_ubicacion_territorial CHECK (
        (
          zona IS NULL AND tipo_ubicacion = 'GPS'
          AND tipo_localidad = 'PENDIENTE_VERIFICACION'
          AND comuna IS NULL AND barrio IS NULL
          AND corregimiento IS NULL AND localidad_rural IS NULL
        ) OR (
          zona IS NOT NULL AND (
            (zona = 'URBANA' AND comuna IS NOT NULL AND barrio IS NOT NULL
              AND corregimiento IS NULL AND localidad_rural IS NULL AND tipo_localidad = 'BARRIO')
            OR
            (zona = 'RURAL' AND comuna IS NULL AND barrio IS NULL
              AND corregimiento IS NOT NULL AND localidad_rural IS NOT NULL
              AND tipo_localidad IN ('VEREDA', 'CENTRO_POBLADO', 'PENDIENTE_VERIFICACION'))
          )
        )
      )
  `)
}

module.exports = { up }
