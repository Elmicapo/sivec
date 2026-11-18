const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
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
