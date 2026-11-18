async function up(connection) {
  const [[database]] = await connection.query('SELECT DATABASE() AS name')
  if (!/^sivec_(?:restore_test|migration_test|isolated)_[a-z0-9_]+$/.test(database.name || '')) {
    throw new Error('Mail migration requires an isolated SIVEC database.')
  }

  await connection.query(`
    CREATE TABLE restablecimiento_password (
      id_usuario INT NOT NULL PRIMARY KEY,
      token_hash BINARY(32) NOT NULL UNIQUE,
      expira_en DATETIME NOT NULL,
      solicitado_en DATETIME NOT NULL,
      FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)
  await connection.query(`
    CREATE TABLE salida_correo (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      destino_hash BINARY(32) NOT NULL,
      contenido TEXT NULL,
      expira_en DATETIME NOT NULL,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      disponible_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      intento TINYINT UNSIGNED NOT NULL DEFAULT 0,
      reserva CHAR(36) NULL,
      enviado_en DATETIME NULL,
      INDEX ix_salida_disponible (disponible_en, id),
      INDEX ix_salida_destino (destino_hash, creado_en)
    ) ENGINE=InnoDB
  `)
  await connection.query('ALTER TABLE usuario ADD COLUMN version_sesion INT UNSIGNED NOT NULL DEFAULT 0')
  await connection.query('ALTER TABLE solicitud_escenario ADD COLUMN correo_notificacion VARCHAR(254) NULL')
}

module.exports = { up }
