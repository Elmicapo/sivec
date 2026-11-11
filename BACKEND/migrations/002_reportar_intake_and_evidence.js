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

async function assertTableNamesAvailable(connection, names) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)`,
    [names]
  )
  assert(rows.length === 0, `Migration table name already exists: ${rows.map((row) => row.TABLE_NAME).join(', ')}.`)
}

async function up(connection) {
  const [[server]] = await connection.query('SELECT VERSION() AS mysql_version')
  assert(/^8\./.test(server.mysql_version), 'Reportar migration requires MySQL 8.')

  for (const table of [
    'disciplina',
    'cmj_consejero',
    'escenario',
    'reporte_veeduria',
    'historial_estado_escenario'
  ]) {
    await assertBaseTable(connection, table)
  }
  await assertTableNamesAvailable(connection, [
    'solicitud_escenario',
    'solicitud_escenario_historial',
    'solicitud_veeduria',
    'evidencia_veeduria'
  ])

  const [reporterColumns] = await connection.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_veeduria'
       AND COLUMN_NAME = 'id_reportante'`
  )
  assert(
    reporterColumns.length === 1
      && reporterColumns[0].COLUMN_TYPE === 'int'
      && reporterColumns[0].IS_NULLABLE === 'NO',
    'reporte_veeduria.id_reportante must be signed INT NOT NULL before decoupling new receipts from persona.'
  )

  const [[d1Columns]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_veeduria'
       AND COLUMN_NAME IN ('id_cmj_oficializa', 'fecha_oficializacion')`
  )
  const [[trigger]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'trg_oficializar_semaforo'`
  )
  assert(Number(d1Columns.found) === 2 && Number(trigger.found) === 0, 'D1 migration must be applied and verified first.')

  await connection.query(
    'ALTER TABLE reporte_veeduria MODIFY COLUMN id_reportante INT NULL'
  )

  await connection.query(`
    CREATE OR REPLACE VIEW v_historico_veedurias AS
    SELECT
      r.id_escenario AS id_escenario,
      e.nombre AS escenario,
      r.id_reporte AS id_reporte,
      r.fecha_reporte AS fecha_reporte,
      pr.nombre_completo AS reportante,
      r.estado_propuesto AS estado_propuesto,
      r.descripcion AS descripcion,
      r.estado_reporte AS estado_reporte,
      pc.nombre_completo AS validado_por,
      r.fecha_validacion AS fecha_validacion,
      r.observacion_cmj AS observacion_cmj
    FROM reporte_veeduria r
    JOIN escenario e ON e.id_escenario = r.id_escenario
    LEFT JOIN persona pr ON pr.id_persona = r.id_reportante
    LEFT JOIN persona pc ON pc.id_persona = r.id_cmj_valida
  `)

  await connection.query(`
    CREATE TABLE solicitud_escenario (
      id_solicitud_escenario INT NOT NULL AUTO_INCREMENT,
      nombre_escenario VARCHAR(150) NOT NULL,
      id_disciplina INT NOT NULL,
      zona ENUM('URBANA', 'RURAL') NOT NULL,
      comuna VARCHAR(100) NULL,
      barrio VARCHAR(120) NULL,
      corregimiento VARCHAR(120) NULL,
      localidad_rural VARCHAR(120) NULL,
      tipo_localidad ENUM('BARRIO', 'VEREDA', 'CENTRO_POBLADO', 'PENDIENTE_VERIFICACION') NOT NULL,
      tipo_ubicacion ENUM('GPS', 'MANUAL') NOT NULL,
      latitud DECIMAL(9,6) NULL,
      longitud DECIMAL(9,6) NULL,
      estado_revision ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
      id_cmj_revisa INT NULL,
      fecha_revision DATETIME NULL,
      observacion_cmj TEXT NULL,
      id_escenario INT NULL,
      fecha_solicitud DATETIME NOT NULL,
      PRIMARY KEY (id_solicitud_escenario),
      UNIQUE KEY uq_solicitud_escenario_inventario (id_escenario),
      KEY ix_solicitud_escenario_estado (estado_revision, fecha_solicitud),
      KEY ix_solicitud_escenario_disciplina (id_disciplina),
      KEY ix_solicitud_escenario_cmj (id_cmj_revisa),
      CONSTRAINT fk_solicitud_escenario_disciplina
        FOREIGN KEY (id_disciplina) REFERENCES disciplina (id_disciplina)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT fk_solicitud_escenario_cmj
        FOREIGN KEY (id_cmj_revisa) REFERENCES cmj_consejero (id_persona)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT fk_solicitud_escenario_inventario
        FOREIGN KEY (id_escenario) REFERENCES escenario (id_escenario)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT ck_solicitud_escenario_territorio
        CHECK (
          (zona = 'URBANA' AND comuna IS NOT NULL AND barrio IS NOT NULL
            AND corregimiento IS NULL AND localidad_rural IS NULL
            AND tipo_localidad = 'BARRIO')
          OR
          (zona = 'RURAL' AND comuna IS NULL AND barrio IS NULL
            AND corregimiento IS NOT NULL AND localidad_rural IS NOT NULL
            AND tipo_localidad IN ('VEREDA', 'CENTRO_POBLADO', 'PENDIENTE_VERIFICACION'))
        ),
      CONSTRAINT ck_solicitud_escenario_gps
        CHECK (
          (tipo_ubicacion = 'MANUAL' AND latitud IS NULL AND longitud IS NULL)
          OR
          (tipo_ubicacion = 'GPS' AND latitud IS NOT NULL AND longitud IS NOT NULL
            AND latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180)
        ),
      CONSTRAINT ck_solicitud_escenario_revision
        CHECK (
          (estado_revision = 'PENDIENTE' AND id_cmj_revisa IS NULL
            AND fecha_revision IS NULL AND id_escenario IS NULL)
          OR
          (estado_revision = 'APROBADA' AND id_cmj_revisa IS NOT NULL
            AND fecha_revision IS NOT NULL AND id_escenario IS NOT NULL)
          OR
          (estado_revision = 'RECHAZADA' AND id_cmj_revisa IS NOT NULL
            AND fecha_revision IS NOT NULL AND id_escenario IS NULL)
        )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  await connection.query(`
    CREATE TABLE solicitud_escenario_historial (
      id_historial_solicitud INT NOT NULL AUTO_INCREMENT,
      id_solicitud_escenario INT NOT NULL,
      estado_anterior ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA') NULL,
      estado_nuevo ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA') NOT NULL,
      id_cmj INT NULL,
      observacion TEXT NULL,
      fecha_evento DATETIME NOT NULL,
      PRIMARY KEY (id_historial_solicitud),
      KEY ix_solicitud_escenario_historial (id_solicitud_escenario, fecha_evento),
      KEY ix_solicitud_escenario_historial_cmj (id_cmj),
      CONSTRAINT fk_solicitud_escenario_historial_solicitud
        FOREIGN KEY (id_solicitud_escenario)
        REFERENCES solicitud_escenario (id_solicitud_escenario)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT fk_solicitud_escenario_historial_cmj
        FOREIGN KEY (id_cmj) REFERENCES cmj_consejero (id_persona)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT ck_solicitud_escenario_historial_actor
        CHECK (
          (estado_nuevo = 'PENDIENTE' AND id_cmj IS NULL)
          OR (estado_nuevo <> 'PENDIENTE' AND id_cmj IS NOT NULL)
        )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  await connection.query(`
    CREATE TABLE solicitud_veeduria (
      id_solicitud_veeduria INT NOT NULL AUTO_INCREMENT,
      codigo_seguimiento_hash BINARY(32) NOT NULL,
      nombre_contacto VARCHAR(150) NOT NULL,
      correo_contacto VARCHAR(254) NOT NULL,
      id_escenario INT NULL,
      id_solicitud_escenario INT NULL,
      estado_propuesto ENUM('VERDE', 'AMARILLO', 'ROJO') NOT NULL,
      descripcion TEXT NOT NULL,
      id_reporte INT NULL,
      fecha_recepcion DATETIME NOT NULL,
      PRIMARY KEY (id_solicitud_veeduria),
      UNIQUE KEY uq_solicitud_veeduria_codigo (codigo_seguimiento_hash),
      UNIQUE KEY uq_solicitud_veeduria_reporte (id_reporte),
      KEY ix_solicitud_veeduria_escenario (id_escenario, fecha_recepcion),
      KEY ix_solicitud_veeduria_propuesta (id_solicitud_escenario, fecha_recepcion),
      CONSTRAINT fk_solicitud_veeduria_escenario
        FOREIGN KEY (id_escenario) REFERENCES escenario (id_escenario)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT fk_solicitud_veeduria_propuesta
        FOREIGN KEY (id_solicitud_escenario)
        REFERENCES solicitud_escenario (id_solicitud_escenario)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT fk_solicitud_veeduria_reporte
        FOREIGN KEY (id_reporte) REFERENCES reporte_veeduria (id_reporte)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT ck_solicitud_veeduria_destino
        CHECK (
          (id_escenario IS NOT NULL AND id_solicitud_escenario IS NULL)
          OR
          (id_escenario IS NULL AND id_solicitud_escenario IS NOT NULL)
        )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  await connection.query(`
    CREATE TABLE evidencia_veeduria (
      id_evidencia INT NOT NULL AUTO_INCREMENT,
      id_solicitud_veeduria INT NOT NULL,
      orden TINYINT UNSIGNED NOT NULL,
      clave_objeto_privado VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      mime_real ENUM('image/jpeg', 'image/png', 'image/webp') NOT NULL,
      bytes_original INT UNSIGNED NOT NULL,
      bytes_optimizada INT UNSIGNED NOT NULL,
      ancho SMALLINT UNSIGNED NOT NULL,
      alto SMALLINT UNSIGNED NOT NULL,
      sha256 BINARY(32) NOT NULL,
      exif_eliminado TINYINT(1) NOT NULL,
      fecha_registro DATETIME NOT NULL,
      PRIMARY KEY (id_evidencia),
      UNIQUE KEY uq_evidencia_clave_privada (clave_objeto_privado),
      UNIQUE KEY uq_evidencia_orden (id_solicitud_veeduria, orden),
      CONSTRAINT fk_evidencia_solicitud
        FOREIGN KEY (id_solicitud_veeduria)
        REFERENCES solicitud_veeduria (id_solicitud_veeduria)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT ck_evidencia_orden CHECK (orden BETWEEN 1 AND 5),
      CONSTRAINT ck_evidencia_bytes CHECK (bytes_original BETWEEN 1 AND 5242880),
      CONSTRAINT ck_evidencia_optimizacion CHECK (bytes_optimizada BETWEEN 1 AND 5242880),
      CONSTRAINT ck_evidencia_dimensiones CHECK (ancho BETWEEN 1 AND 1920 AND alto BETWEEN 1 AND 1920),
      CONSTRAINT ck_evidencia_exif CHECK (exif_eliminado = 1)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  const [[postflight]] = await connection.query(
    `SELECT
       (SELECT COUNT(*) FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN
          ('solicitud_escenario', 'solicitud_escenario_historial', 'solicitud_veeduria', 'evidencia_veeduria')
          AND ENGINE = 'InnoDB') AS created_tables,
       (SELECT IS_NULLABLE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_veeduria'
          AND COLUMN_NAME = 'id_reportante') AS reporter_nullable`
  )
  assert(Number(postflight.created_tables) === 4, 'Reportar postflight: expected InnoDB tables are missing.')
  assert(postflight.reporter_nullable === 'YES', 'Reportar postflight: legacy reporter FK must allow NULL for new contact snapshots.')
}

module.exports = { up }
