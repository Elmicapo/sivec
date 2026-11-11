const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { assertMigrationsApplied, SchemaNotReadyError } = require('../utils/schemaAvailability');

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const GENEROS = new Set(['F', 'M', 'OTRO']);

const createAuthController = ({
    database = db,
    passwordHasher = bcrypt,
    tokenSigner = jwt
} = {}) => {
    const login = async (req, res) => {
        const { login: nombreUsuario, correo, password } = req.body;
        const credencial = nombreUsuario || correo;

        if (!credencial || !password) {
            return res.status(400).json({
                success: false,
                message: 'Por favor ingresa tu correo electrónico y contraseña'
            });
        }

        try {
            const [resultados] = await database.query(
                `SELECT u.id_usuario, u.login, u.password_hash, u.activo,
                        r.id_rol, r.nombre AS nombre_rol,
                        p.id_persona, p.nombre_completo, p.correo_electronico
                 FROM usuario u
                 JOIN persona p ON u.id_persona = p.id_persona
                 JOIN rol r ON u.id_rol = r.id_rol
                 WHERE (u.login = ? OR p.correo_electronico = ?) AND u.activo = TRUE`,
                [credencial, credencial]
            );

            if (resultados.length === 0) {
                return res.status(401).json({ success: false, message: 'Credenciales inválidas o usuario inactivo' });
            }

            const usuario = resultados[0];
            const passwordValida = await passwordHasher.compare(password, usuario.password_hash);
            if (!passwordValida) {
                return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
            }

            await database.query('UPDATE usuario SET ultimo_acceso = NOW() WHERE id_usuario = ?', [usuario.id_usuario]);

            const token = tokenSigner.sign(
                {
                    id_usuario: usuario.id_usuario,
                    id_persona: usuario.id_persona,
                    nombre: usuario.nombre_completo,
                    rol: usuario.nombre_rol
                },
                process.env.JWT_SECRET,
                { expiresIn: '8h' }
            );

            return res.json({
                success: true,
                message: 'Inicio de sesión exitoso',
                token,
                usuario: {
                    id_usuario: usuario.id_usuario,
                    id_persona: usuario.id_persona,
                    nombre: usuario.nombre_completo,
                    correo: usuario.correo_electronico,
                    rol: usuario.nombre_rol
                }
            });
        } catch (error) {
            console.error('Error en login:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    };

    const registrar = async (req, res) => {
        const body = req.body || {};
        const tipoUsuario = body.tipo_usuario || 'DEPORTISTA';
        const nombre = typeof body.nombre_completo === 'string' ? body.nombre_completo.trim() : '';
        const identificacion = typeof body.numero_identificacion === 'string' ? body.numero_identificacion.trim() : '';
        const correo = typeof body.correo_electronico === 'string' ? body.correo_electronico.trim().toLowerCase() : '';
        const usuarioLogin = typeof body.login === 'string' ? body.login.trim() : '';
        const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : '';
        const password = body.password;

        if (!['DEPORTISTA', 'ENTRENADOR'].includes(tipoUsuario)) {
            return res.status(400).json({ success: false, message: 'Tipo de cuenta no permitido' });
        }
        if (!nombre || !identificacion || !correo || !usuarioLogin || !password || !telefono) {
            return res.status(400).json({ success: false, message: 'Completa todos los campos obligatorios' });
        }
        if (nombre.length > 150 || identificacion.length > 20 || correo.length > 120
            || usuarioLogin.length > 50 || telefono.length > 20) {
            return res.status(400).json({ success: false, message: 'Uno o más campos superan la longitud permitida' });
        }
        if (!EMAIL_PATTERN.test(correo)) {
            return res.status(400).json({ success: false, message: 'El correo electrónico no es válido' });
        }
        if (usuarioLogin.length < 4) {
            return res.status(400).json({ success: false, message: 'El nombre de usuario debe tener al menos 4 caracteres' });
        }
        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
        }

        const genero = body.genero;
        const fechaNacimiento = body.fecha_nacimiento;
        const direccion = typeof body.direccion_residencia === 'string'
            ? body.direccion_residencia.trim()
            : '';
        const idDisciplina = Number(body.id_disciplina);

        if (tipoUsuario === 'DEPORTISTA') {
            const fechaValida = typeof fechaNacimiento === 'string'
                && /^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)
                && !Number.isNaN(Date.parse(`${fechaNacimiento}T00:00:00Z`))
                && new Date(`${fechaNacimiento}T00:00:00Z`).toISOString().slice(0, 10) === fechaNacimiento
                && fechaNacimiento <= new Date().toISOString().slice(0, 10);
            if (!GENEROS.has(genero) || !fechaValida || !direccion) {
                return res.status(400).json({
                    success: false,
                    message: 'Para registrarte como deportista, completa género, fecha de nacimiento y dirección'
                });
            }
            if (direccion.length > 200) {
                return res.status(400).json({ success: false, message: 'La dirección supera la longitud permitida' });
            }
        } else if (!Number.isSafeInteger(idDisciplina) || idDisciplina <= 0) {
            return res.status(400).json({ success: false, message: 'Selecciona el deporte que entrenas' });
        }

        const connection = await database.getConnection();
        try {
            await connection.beginTransaction();
            if (tipoUsuario === 'ENTRENADOR') {
                await assertMigrationsApplied(connection, ['004']);
            }

            const [rol] = await connection.query('SELECT id_rol FROM rol WHERE nombre = ?', [tipoUsuario]);
            if (!rol.length) {
                await connection.rollback();
                return res.status(500).json({ success: false, message: `El rol ${tipoUsuario} no existe en la base de datos` });
            }

            if (tipoUsuario === 'ENTRENADOR') {
                const [disciplinas] = await connection.query(
                    'SELECT estado FROM disciplina WHERE id_disciplina = ? LIMIT 1',
                    [idDisciplina]
                );
                if (!disciplinas.length) {
                    await connection.rollback();
                    return res.status(404).json({
                        success: false,
                        message: 'La disciplina seleccionada no existe.'
                    });
                }
                if (disciplinas[0].estado !== 'ACTIVA') {
                    await connection.rollback();
                    return res.status(409).json({
                        success: false,
                        message: 'La disciplina seleccionada está inactiva.'
                    });
                }
            }

            const [loginUsado] = await connection.query('SELECT 1 FROM usuario WHERE login = ?', [usuarioLogin]);
            if (loginUsado.length) {
                await connection.rollback();
                return res.status(409).json({ success: false, message: 'Ese nombre de usuario ya está en uso' });
            }

            const [porId] = await connection.query(
                `SELECT id_persona, nombre_completo, correo_electronico, telefono,
                        direccion_residencia, genero, fecha_nacimiento
                 FROM persona WHERE numero_identificacion = ? FOR UPDATE`,
                [identificacion]
            );
            const [porCorreo] = await connection.query(
                'SELECT id_persona FROM persona WHERE correo_electronico = ? FOR UPDATE',
                [correo]
            );

            let idPersona;
            if (porId.length) {
                const persona = porId[0];
                const samePerson = persona.nombre_completo === nombre
                    && persona.correo_electronico.toLowerCase() === correo
                    && persona.telefono === telefono
                    && (tipoUsuario !== 'DEPORTISTA'
                        || (persona.direccion_residencia === direccion
                            && persona.genero === genero
                            && String(persona.fecha_nacimiento).slice(0, 10) === fechaNacimiento));
                if (!samePerson || porCorreo.some((row) => row.id_persona !== persona.id_persona)) {
                    await connection.rollback();
                    return res.status(409).json({
                        success: false,
                        message: 'La identificación o el correo ya están registrados; verifica los datos o comunícate con soporte'
                    });
                }
                idPersona = persona.id_persona;
                const [yaTieneUsuario] = await connection.query('SELECT 1 FROM usuario WHERE id_persona = ?', [idPersona]);
                if (yaTieneUsuario.length) {
                    await connection.rollback();
                    return res.status(409).json({ success: false, message: 'Ya existe una cuenta con esa identificación' });
                }
            } else {
                if (porCorreo.length) {
                    await connection.rollback();
                    return res.status(409).json({ success: false, message: 'Ese correo ya está registrado' });
                }
                const [persona] = await connection.query(
                    `INSERT INTO persona
                        (nombre_completo, numero_identificacion, correo_electronico,
                         telefono, direccion_residencia, genero, fecha_nacimiento)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        nombre,
                        identificacion,
                        correo,
                        telefono,
                        tipoUsuario === 'DEPORTISTA' ? direccion : null,
                        tipoUsuario === 'DEPORTISTA' ? genero : null,
                        tipoUsuario === 'DEPORTISTA' ? fechaNacimiento : null
                    ]
                );
                idPersona = persona.insertId;
            }

            const passwordHash = await passwordHasher.hash(password, 10);
            await connection.query(
                'INSERT INTO usuario (id_persona, id_rol, login, password_hash, activo) VALUES (?, ?, ?, ?, TRUE)',
                [idPersona, rol[0].id_rol, usuarioLogin, passwordHash]
            );

            if (tipoUsuario === 'DEPORTISTA') {
                await connection.query('INSERT IGNORE INTO deportista (id_persona) VALUES (?)', [idPersona]);
            } else {
                await connection.query('INSERT INTO entrenador (id_persona) VALUES (?)', [idPersona]);
                await connection.query(
                    `INSERT INTO solicitud_vinculacion_entrenador
                        (id_entrenador, id_disciplina, estado)
                     VALUES (?, ?, 'PENDIENTE')`,
                    [idPersona, idDisciplina]
                );
            }

            await connection.commit();
            return res.status(201).json({
                success: true,
                message: tipoUsuario === 'ENTRENADOR'
                    ? 'Registro exitoso. Tu solicitud de vinculación fue enviada para aprobación administrativa.'
                    : 'Registro exitoso',
                tipo_usuario: tipoUsuario
            });
        } catch (error) {
            await connection.rollback();
            if (error instanceof SchemaNotReadyError) {
                return res.status(503).json({
                    success: false,
                    code: error.code,
                    message: 'El flujo de registro de entrenadores aún no está habilitado.'
                });
            }
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: 'Ya existe una cuenta con esos datos' });
            }
            if (error.code === 'ER_NO_SUCH_TABLE'
                && error.message.includes('solicitud_vinculacion_entrenador')) {
                console.error('El registro de entrenador requiere la migración de solicitudes de vinculación.');
                return res.status(503).json({
                    success: false,
                    message: 'El registro de entrenadores estará disponible cuando se habilite el flujo de aprobación administrativa'
                });
            }
            console.error('Error en registro:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        } finally {
            connection.release();
        }
    };

    return { login, registrar };
};

module.exports = { ...createAuthController(), createAuthController };
