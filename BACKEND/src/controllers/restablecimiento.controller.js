const { createHash, randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { configuracionCorreo, correoValido, encolarCorreo, versionarSesiones } = require('../services/correo.service');

const RECIBIDO = 'Si existe una cuenta activa con ese correo, recibirás un enlace para cambiar tu contraseña.';
const INVALIDO = 'El enlace venció o ya fue utilizado. Solicita uno nuevo.';
const hashToken = token => createHash('sha256').update(token).digest();

function crearRestablecimiento({ database = db, passwordHasher = bcrypt } = {}) {
    async function transaccion(operacion) {
        const connection = await database.getConnection();
        try {
            await connection.beginTransaction();
            const result = await operacion(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    const informarError = (res, error) => {
        console.error('Restablecimiento SIVEC:', error.code || 'ERROR');
        const status = error.code === 'ER_NO_SUCH_TABLE' ? 503 : 500;
        return res.status(status).json({ success: false, message: 'No pudimos procesar la solicitud. Intenta más tarde.' });
    };

    const solicitarRestablecimiento = async (req, res) => {
        const config = configuracionCorreo();
        if (!config) {
            return res.status(503).json({ success: false, message: 'El envío de correos aún no está habilitado.' });
        }
        const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim().toLowerCase() : '';
        if (!correoValido(correo)) {
            return res.status(400).json({ success: false, message: 'Ingresa un correo electrónico válido.' });
        }

        try {
            await transaccion(async connection => {
                const [usuarios] = await connection.query(
                    `SELECT u.id_usuario FROM usuario u JOIN persona p ON p.id_persona = u.id_persona
                      WHERE p.correo_electronico = ? AND u.activo = TRUE LIMIT 2 FOR UPDATE`, [correo]
                );
                if (usuarios.length !== 1) return;
                const [{ id_usuario: idUsuario }] = usuarios;
                const [[reciente]] = await connection.query(
                    `SELECT id_usuario FROM restablecimiento_password
                      WHERE id_usuario = ? AND solicitado_en > UTC_TIMESTAMP() - INTERVAL 5 MINUTE`, [idUsuario]
                );
                if (reciente) return;

                const token = randomBytes(32).toString('hex');
                await connection.query(
                    `INSERT INTO restablecimiento_password (id_usuario, token_hash, expira_en, solicitado_en)
                     VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 30 MINUTE, UTC_TIMESTAMP())
                     ON DUPLICATE KEY UPDATE token_hash = ?, expira_en = UTC_TIMESTAMP() + INTERVAL 30 MINUTE,
                         solicitado_en = UTC_TIMESTAMP()`,
                    [idUsuario, hashToken(token), hashToken(token)]
                );
                await encolarCorreo(connection, {
                    para: correo,
                    asunto: 'Restablece tu contraseña de SIVEC',
                    texto: `Usa este enlace de un solo uso durante los próximos 30 minutos:\n${config.web}/restablecer-contrasena#${token}\n\nSi no solicitaste el cambio, puedes ignorar este mensaje.`,
                    vigenciaMinutos: 30
                });
            });
            return res.status(202).json({ success: true, message: RECIBIDO });
        } catch (error) {
            return informarError(res, error);
        }
    };

    const restablecerPassword = async (req, res) => {
        if (!versionarSesiones()) {
            return res.status(503).json({ success: false, message: 'El restablecimiento de contraseña aún no está habilitado.' });
        }
        const { token, password } = req.body || {};
        if (typeof token !== 'string' || !/^[a-f\d]{64}$/.test(token)) {
            return res.status(400).json({ success: false, message: INVALIDO });
        }
        if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres y un máximo de 72 bytes.' });
        }

        try {
            const actualizado = await transaccion(async connection => {
                const [[fila]] = await connection.query(
                    `SELECT u.id_usuario FROM restablecimiento_password r JOIN usuario u ON u.id_usuario = r.id_usuario
                      WHERE r.token_hash = ? AND r.expira_en > UTC_TIMESTAMP() AND u.activo = TRUE FOR UPDATE`,
                    [hashToken(token)]
                );
                if (!fila) return false;
                const passwordHash = await passwordHasher.hash(password, 10);
                await connection.query('UPDATE usuario SET password_hash = ?, version_sesion = version_sesion + 1 WHERE id_usuario = ?', [passwordHash, fila.id_usuario]);
                await connection.query('DELETE FROM restablecimiento_password WHERE id_usuario = ?', [fila.id_usuario]);
                return true;
            });

            if (!actualizado) return res.status(400).json({ success: false, message: INVALIDO });
            return res.json({ success: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
        } catch (error) {
            return informarError(res, error);
        }
    };

    return { solicitarRestablecimiento, restablecerPassword };
}

module.exports = { ...crearRestablecimiento(), crearRestablecimiento };
