const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthController } = require('./auth.controller');

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

function registrationDatabase({
    missingRequestTable = false,
    discipline = { estado: 'ACTIVA' },
    appliedMigrations = ['004']
} = {}) {
    const calls = [];
    const connection = {
        committed: false,
        rolledBack: false,
        released: false,
        async beginTransaction() {},
        async commit() { this.committed = true; },
        async rollback() { this.rolledBack = true; },
        release() { this.released = true; },
        async query(sql, values = []) {
            calls.push({ sql, values });
            if (sql.includes('FROM sivec_schema_migrations')) {
                return [appliedMigrations.map((version) => ({ version, status: 'APPLIED' }))];
            }
            if (sql.includes('SELECT id_rol FROM rol')) return [[{ id_rol: values[0] === 'ENTRENADOR' ? 2 : 1 }]];
            if (sql.includes('SELECT estado FROM disciplina')) return [discipline ? [discipline] : []];
            if (sql.includes('SELECT 1 FROM usuario WHERE login')) return [[]];
            if (sql.includes('FROM persona WHERE numero_identificacion')) return [[]];
            if (sql.includes('FROM persona WHERE correo_electronico')) return [[]];
            if (sql.includes('INSERT INTO persona')) return [{ insertId: 10 }];
            if (sql.includes('INSERT INTO solicitud_vinculacion_entrenador') && missingRequestTable) {
                throw Object.assign(new Error("Table 'solicitud_vinculacion_entrenador' doesn't exist"), {
                    code: 'ER_NO_SUCH_TABLE'
                });
            }
            return [{ affectedRows: 1 }];
        }
    };
    const database = {
        async getConnection() { return connection; },
        calls,
        connection
    };
    return database;
}

const ATHLETE = {
    tipo_usuario: 'DEPORTISTA',
    nombre_completo: 'Ada Deportista',
    numero_identificacion: 'ID-100',
    correo_electronico: 'ada@example.org',
    login: 'ada100',
    telefono: '3005550100',
    genero: 'F',
    fecha_nacimiento: '2000-01-02',
    direccion_residencia: 'Calle 1',
    password: 'secure-password'
};

test('public registration rejects administrative and CMJ role injection', async () => {
    const database = registrationDatabase();
    const controller = createAuthController({ database });
    for (const tipo_usuario of ['ADMINISTRATIVO', 'CMJ', 'OWNER']) {
        const res = response();
        await controller.registrar({ body: { ...ATHLETE, tipo_usuario } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(database.connection.released, false);
    }
    assert.equal(database.calls.length, 0);
});

test('athlete registration stores required personal fields and only the password hash', async () => {
    const database = registrationDatabase();
    const passwordHasher = {
        async hash(password, rounds) {
            assert.equal(password, ATHLETE.password);
            assert.equal(rounds, 10);
            return 'bcrypt-hash';
        }
    };
    const controller = createAuthController({ database, passwordHasher });
    const res = response();
    await controller.registrar({ body: ATHLETE }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(database.connection.committed, true);
    assert.equal(database.connection.released, true);
    const personInsert = database.calls.find(({ sql }) => sql.includes('INSERT INTO persona'));
    assert.deepEqual(personInsert.values, [
        ATHLETE.nombre_completo,
        ATHLETE.numero_identificacion,
        ATHLETE.correo_electronico,
        ATHLETE.telefono,
        ATHLETE.direccion_residencia,
        ATHLETE.genero,
        ATHLETE.fecha_nacimiento
    ]);
    const userInsert = database.calls.find(({ sql }) => sql.includes('INSERT INTO usuario'));
    assert.equal(userInsert.values[3], 'bcrypt-hash');
    assert.equal(userInsert.values.includes(ATHLETE.password), false);
    assert.ok(database.calls.some(({ sql }) => sql.includes('INSERT IGNORE INTO deportista')));
});

test('trainer registration queues a pending discipline request without creating an association', async () => {
    const database = registrationDatabase();
    const controller = createAuthController({
        database,
        passwordHasher: { async hash() { return 'bcrypt-hash'; } }
    });

    function trainerRegistrationBody() {
        return {
            tipo_usuario: 'ENTRENADOR',
            nombre_completo: 'Ada Entrenadora',
            numero_identificacion: 'ID-101',
            correo_electronico: 'ada.trainer@example.org',
            login: 'ada101',
            telefono: '3005550101',
            id_disciplina: 7,
            password: 'secure-password'
        };
    }

    test('trainer registration rejects a nonexistent discipline before creating account records', async () => {
        const database = registrationDatabase({ discipline: null });
        const controller = createAuthController({ database });
        const res = response();

        await controller.registrar({ body: trainerRegistrationBody() }, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.body.message, 'La disciplina seleccionada no existe.');
        assert.equal(database.connection.rolledBack, true);
        assert.equal(database.connection.committed, false);
        assert.equal(database.calls.some(({ sql }) => sql.includes('INSERT INTO persona')), false);
        assert.equal(database.calls.some(({ sql }) => sql.includes('INSERT INTO usuario')), false);
        assert.equal(database.calls.some(({ sql }) => sql.includes('INSERT INTO solicitud_vinculacion_entrenador')), false);
    });

    test('trainer registration fails before inserts when migration 004 is unavailable', async () => {
        const database = registrationDatabase({ appliedMigrations: [] });
        const controller = createAuthController({ database });
        const res = response();

        await controller.registrar({ body: trainerRegistrationBody() }, res);

        assert.equal(res.statusCode, 503);
        assert.equal(res.body.code, 'SCHEMA_NOT_READY');
        assert.equal(database.connection.rolledBack, true);
        assert.equal(database.connection.calls, undefined);
        assert.equal(database.calls.some(({ sql }) => sql.includes('INSERT INTO persona')), false);
        assert.equal(database.calls.some(({ sql }) => sql.includes('SELECT id_rol FROM rol')), false);
    });

    test('trainer registration rejects an inactive discipline before creating account records', async () => {
        const database = registrationDatabase({ discipline: { estado: 'INACTIVA' } });
        const controller = createAuthController({ database });
        const res = response();

        await controller.registrar({ body: trainerRegistrationBody() }, res);

        assert.equal(res.statusCode, 409);
        assert.equal(res.body.message, 'La disciplina seleccionada está inactiva.');
        assert.equal(database.connection.rolledBack, true);
        assert.equal(database.connection.committed, false);
        assert.equal(database.calls.some(({ sql }) => sql.includes('INSERT INTO persona')), false);
        assert.equal(database.calls.some(({ sql }) => sql.includes('INSERT INTO usuario')), false);
        assert.equal(database.calls.some(({ sql }) => sql.includes('INSERT INTO solicitud_vinculacion_entrenador')), false);
    });

    test('trainer registration validates an active discipline before continuing', async () => {
        const database = registrationDatabase({ discipline: { estado: 'ACTIVA' } });
        const controller = createAuthController({
            database,
            passwordHasher: { async hash() { return 'bcrypt-hash'; } }
        });
        const res = response();

        await controller.registrar({ body: trainerRegistrationBody() }, res);

        assert.equal(res.statusCode, 201);
        assert.equal(database.connection.committed, true);
        const disciplineCheck = database.calls.find(({ sql }) => sql.includes('SELECT estado FROM disciplina'));
        assert.deepEqual(disciplineCheck.values, [7]);
        assert.ok(database.calls.some(({ sql }) => sql.includes('INSERT INTO solicitud_vinculacion_entrenador')));
    });
    const res = response();
    await controller.registrar({
        body: {
            tipo_usuario: 'ENTRENADOR',
            nombre_completo: 'Ada Entrenadora',
            numero_identificacion: 'ID-101',
            correo_electronico: 'ada.trainer@example.org',
            login: 'ada101',
            telefono: '3005550101',
            id_disciplina: 7,
            password: 'secure-password'
        }
    }, res);

    assert.equal(res.statusCode, 201);
    assert.match(res.body.message, /aprobación administrativa/);
    assert.ok(database.calls.some(({ sql, values }) =>
        sql.includes('INSERT INTO solicitud_vinculacion_entrenador')
        && values[0] === 10 && values[1] === 7))
    assert.equal(database.calls.some(({ sql }) => sql.includes('INSERT INTO disciplina_entrenador')), false);
});

test('trainer signup rolls back and reports unavailable approval schema', async () => {
    const database = registrationDatabase({ missingRequestTable: true });
    const controller = createAuthController({
        database,
        passwordHasher: { async hash() { return 'bcrypt-hash'; } }
    });
    const res = response();
    await controller.registrar({
        body: {
            tipo_usuario: 'ENTRENADOR',
            nombre_completo: 'Ada Entrenadora',
            numero_identificacion: 'ID-101',
            correo_electronico: 'ada.trainer@example.org',
            login: 'ada101',
            telefono: '3005550101',
            id_disciplina: 7,
            password: 'secure-password'
        }
    }, res);

    assert.equal(res.statusCode, 503);
    assert.equal(database.connection.rolledBack, true);
    assert.equal(database.connection.committed, false);
});

test('invalid athlete fields and mismatched passwords are rejected by registration validation', async () => {
    const database = registrationDatabase();
    const controller = createAuthController({ database });
    const invalid = [
        { ...ATHLETE, correo_electronico: 'not-an-email' },
        { ...ATHLETE, genero: 'INVALID' },
        { ...ATHLETE, fecha_nacimiento: '2999-01-01' },
        { ...ATHLETE, numero_identificacion: 'x'.repeat(21) },
        { ...ATHLETE, password: 'short' }
    ];
    for (const body of invalid) {
        const res = response();
        await controller.registrar({ body }, res);
        assert.equal(res.statusCode, 400);
    }
    assert.equal(database.connection.released, false);
});

test('login accepts email and returns the role issued in the JWT and user object', async () => {
    const database = {
        async query(sql, values) {
            if (sql.includes('FROM usuario u')) {
                assert.deepEqual(values, ['ada@example.org', 'ada@example.org']);
                return [[{
                    id_usuario: 5,
                    id_persona: 10,
                    login: 'ada100',
                    password_hash: 'stored-hash',
                    nombre_completo: 'Ada Deportista',
                    correo_electronico: 'ada@example.org',
                    nombre_rol: 'DEPORTISTA'
                }]];
            }
            return [{ affectedRows: 1 }];
        }
    };
    const passwordHasher = {
        async compare(password, hash) {
            assert.equal(password, 'secure-password');
            assert.equal(hash, 'stored-hash');
            return true;
        }
    };
    const tokenSigner = {
        sign(payload, secret, options) {
            assert.equal(payload.rol, 'DEPORTISTA');
            assert.equal(options.expiresIn, '8h');
            return 'signed-token';
        }
    };
    const controller = createAuthController({ database, passwordHasher, tokenSigner });
    const res = response();
    await controller.login({ body: { correo: 'ada@example.org', password: 'secure-password' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.token, 'signed-token');
    assert.equal(res.body.usuario.rol, 'DEPORTISTA');
});
