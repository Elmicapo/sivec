class SchemaNotReadyError extends Error {
    constructor(code = 'SCHEMA_NOT_READY', message = 'El esquema requerido aún no está disponible.') {
        super(message);
        this.name = 'SchemaNotReadyError';
        this.statusCode = 503;
        this.code = code;
    }
}

function createSchemaError(options) {
    return typeof options.createError === 'function'
        ? options.createError(options.code, options.message)
        : new SchemaNotReadyError(options.code, options.message);
}

async function assertMigrationsApplied(connection, requiredVersions, options = {}) {
    const versions = [...new Set(requiredVersions.map((version) => String(version)))];
    if (versions.length === 0) return;

    const placeholders = versions.map(() => '?').join(', ');
    let rows;
    try {
        [rows] = await connection.query(
            `SELECT version FROM sivec_schema_migrations
              WHERE version IN (${placeholders}) AND status = 'APPLIED'`,
            versions
        );
    } catch (error) {
        if (error?.code === 'ER_NO_SUCH_TABLE') {
            throw createSchemaError(options);
        }
        throw error;
    }

    const applied = new Set(
        rows
            .filter((row) => row.status === undefined || row.status === 'APPLIED')
            .map((row) => String(row.version))
    );
    if (versions.some((version) => !applied.has(version))) {
        throw createSchemaError(options);
    }
}

async function assertSchemaObjectsAvailable(connection, requiredObjects, options = {}) {
    const objects = [...new Map(requiredObjects.map((object) => {
        const normalized = typeof object === 'string'
            ? { name: object }
            : { ...object };
        return [normalized.name, normalized];
    })).values()];
    if (objects.length === 0) return;

    const placeholders = objects.map(() => '?').join(', ');
    const [rows] = await connection.query(
        `SELECT TABLE_NAME AS name, TABLE_TYPE AS type
           FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
        objects.map((object) => object.name)
    );

    const available = new Map(rows.map((row) => [String(row.name), String(row.type)]));
    const unavailable = objects.some((object) => {
        const expectedType = object.type || 'BASE TABLE';
        return available.get(object.name) !== expectedType;
    });
    if (unavailable) {
        throw createSchemaError(options);
    }
}

module.exports = {
    assertMigrationsApplied,
    assertSchemaObjectsAvailable,
    SchemaNotReadyError
};
