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

async function up(connection) {
  const [[server]] = await connection.query('SELECT DATABASE() AS database_name, VERSION() AS mysql_version')
  assert(/^8\./.test(server.mysql_version), 'Registration migration requires MySQL 8.')

  for (const table of ['persona', 'usuario', 'rol', 'entrenador', 'disciplina', 'disciplina_entrenador', 'administrativo']) {
    await assertBaseTable(connection, table)
  }

  const [singleColumnEmailIndexes] = await connection.query(
    `SELECT INDEX_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persona'
     GROUP BY INDEX_NAME
     HAVING MAX(NON_UNIQUE) = 0
        AND COUNT(*) = 1
        AND SUM(COLUMN_NAME = 'correo_electronico') = 1`
  )
  const [singleColumnIdentificationIndexes] = await connection.query(
    `SELECT INDEX_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persona'
     GROUP BY INDEX_NAME
     HAVING MAX(NON_UNIQUE) = 0
        AND COUNT(*) = 1
        AND SUM(COLUMN_NAME = 'numero_identificacion') = 1`
  )
  if (singleColumnEmailIndexes.length === 0) {
    const [[duplicates]] = await connection.query(
      `SELECT COUNT(*) AS groups_found FROM (
         SELECT correo_electronico
         FROM persona
         WHERE correo_electronico IS NOT NULL
         GROUP BY correo_electronico
         HAVING COUNT(*) > 1
       ) AS duplicate_emails`
    )
    assert(Number(duplicates.groups_found) === 0,
      'Duplicate emails prevent the unique registration constraint; review existing data before migration.')
  }
  if (singleColumnIdentificationIndexes.length === 0) {
    const [[duplicates]] = await connection.query(
      `SELECT COUNT(*) AS id_groups_found FROM (
         SELECT numero_identificacion
         FROM persona
         WHERE numero_identificacion IS NOT NULL
         GROUP BY numero_identificacion
         HAVING COUNT(*) > 1
       ) AS duplicate_identifications`
    )
    assert(Number(duplicates.id_groups_found) === 0,
      'Duplicate identification numbers prevent the unique registration constraint; review existing data before migration.')
  }

  const [existing] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'solicitud_vinculacion_entrenador'`
  )
  assert(existing.length === 0, 'solicitud_vinculacion_entrenador already exists; inspect the schema.')

  if (singleColumnEmailIndexes.length === 0) {
    await connection.query(
      'ALTER TABLE persona ADD UNIQUE INDEX uq_persona_correo_electronico (correo_electronico)'
    )
  }
  if (singleColumnIdentificationIndexes.length === 0) {
    await connection.query(
      'ALTER TABLE persona ADD UNIQUE INDEX uq_persona_numero_identificacion (numero_identificacion)'
    )
  }

  await connection.query(`
    CREATE TABLE solicitud_vinculacion_entrenador (
      id_solicitud_vinculacion INT NOT NULL AUTO_INCREMENT,
      id_entrenador INT NOT NULL,
      id_disciplina INT NOT NULL,
      estado ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
      fecha_solicitud DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      id_administrativo_resuelve INT NULL,
      fecha_resolucion DATETIME NULL,
      PRIMARY KEY (id_solicitud_vinculacion),
      KEY ix_solicitud_vinculacion_estado (estado, fecha_solicitud),
      KEY ix_solicitud_vinculacion_entrenador (id_entrenador, estado),
      CONSTRAINT fk_solicitud_vinculacion_entrenador
        FOREIGN KEY (id_entrenador) REFERENCES entrenador (id_persona)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT fk_solicitud_vinculacion_disciplina
        FOREIGN KEY (id_disciplina) REFERENCES disciplina (id_disciplina)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT fk_solicitud_vinculacion_administrativo
        FOREIGN KEY (id_administrativo_resuelve) REFERENCES administrativo (id_persona)
        ON UPDATE NO ACTION ON DELETE NO ACTION,
      CONSTRAINT ck_solicitud_vinculacion_resolucion
        CHECK (
          (estado = 'PENDIENTE' AND id_administrativo_resuelve IS NULL AND fecha_resolucion IS NULL)
          OR
          (estado IN ('APROBADA', 'RECHAZADA')
            AND id_administrativo_resuelve IS NOT NULL AND fecha_resolucion IS NOT NULL)
        )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)

  const [[postflight]] = await connection.query(
    `SELECT
       (SELECT ENGINE FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'solicitud_vinculacion_entrenador') AS request_engine,
       (SELECT COUNT(*) FROM (
          SELECT INDEX_NAME
          FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persona'
          GROUP BY INDEX_NAME
          HAVING MAX(NON_UNIQUE) = 0
             AND COUNT(*) = 1
             AND SUM(COLUMN_NAME = 'correo_electronico') = 1
        ) AS unique_email_indexes) AS email_unique_index,
       (SELECT COUNT(*) FROM (
          SELECT INDEX_NAME
          FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persona'
          GROUP BY INDEX_NAME
          HAVING MAX(NON_UNIQUE) = 0
             AND COUNT(*) = 1
             AND SUM(COLUMN_NAME = 'numero_identificacion') = 1
        ) AS unique_identification_indexes) AS identification_unique_index,
       (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'solicitud_vinculacion_entrenador'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY') AS foreign_keys,
       (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'solicitud_vinculacion_entrenador'
          AND CONSTRAINT_NAME = 'ck_solicitud_vinculacion_resolucion'
          AND CONSTRAINT_TYPE = 'CHECK') AS resolution_check`
  )
  assert(postflight.request_engine === 'InnoDB', 'Trainer request table was not created as InnoDB.')
  assert(Number(postflight.email_unique_index) === 1, 'Unique email index is missing.')
  assert(Number(postflight.identification_unique_index) === 1, 'Unique identification index is missing.')
  assert(Number(postflight.foreign_keys) === 3, 'Trainer request foreign keys are incomplete.')
  assert(Number(postflight.resolution_check) === 1, 'Trainer request resolution check is missing.')
}

module.exports = { up }
