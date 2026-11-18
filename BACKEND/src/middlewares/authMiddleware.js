const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { versionarSesiones } = require('../services/correo.service');

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(403).json({ message: "No se proporcionó un token" });
    }

    const token = authHeader.match(/^Bearer\s+(\S+)$/i)?.[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ message: "Token inválido o expirado." });
    }

    if (versionarSesiones()) {
        try {
            const [[cuenta]] = await db.query(
                'SELECT version_sesion FROM usuario WHERE id_usuario = ? AND activo = TRUE',
                [req.user.id_usuario]
            );
            if (!cuenta || Number(cuenta.version_sesion) !== (req.user.version_sesion ?? 0)) {
                return res.status(401).json({ message: 'Tu sesión terminó. Vuelve a iniciar sesión.' });
            }
        } catch (error) {
            console.error('Verificación de sesión SIVEC:', error.code || 'ERROR');
            return res.status(503).json({ message: 'No se pudo comprobar la sesión. Intenta más tarde.' });
        }
    }

    req.usuario = req.user;
    next();
};

const permitirRoles = (...rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({
                message: "Acceso denegado: No tienes los permisos requeridos para esta acción"
            });
        }
        next();
    };
};

module.exports = {
    verifyToken,
    verificarToken: verifyToken,
    permitirRoles
};
