const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    // 1. Verificamos si la cabecera llega desde React
    console.log("Cabecera Authorization recibida:", authHeader);

    if (!authHeader) {
        return res.status(403).json({ message: "No se proporcionó un token" });
    }

    const token = authHeader.split(' ')[1];
    
    // 2. Verificamos cómo se extrajo el token y si el servidor conoce la clave secreta
    console.log("Token extraído:", token);
    console.log("Clave secreta (JWT_SECRET):", process.env.JWT_SECRET);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        // 3. Verificamos el motivo exacto del rechazo
        console.log("Motivo del error JWT:", error.message);
        return res.status(401).json({ message: "Token inválido o expirado." });
    }

    const jwt = require('jsonwebtoken');

// 1. Middleware para verificar que el JWT sea válido
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    console.log("Cabecera Authorization recibida:", authHeader);

    if (!authHeader) {
        return res.status(403).json({ message: "No se proporcionó un token" });
    }

    const token = authHeader.split(' ')[1];
    
    console.log("Token extraído:", token);
    console.log("Clave secreta (JWT_SECRET):", process.env.JWT_SECRET);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Asigna los datos del usuario decodificado a la petición
        next();
    } catch (error) {
        console.log("Motivo del error JWT:", error.message);
        return res.status(401).json({ message: "Token inválido o expirado." });
    }
};

// 2. Middleware para validar los roles de usuario (FALTABA ESTE BLOQUE)
const permitirRoles = (...rolesPermitidos) => {
    return (req, res, next) => {
        // Verifica que el usuario haya sido autenticado y su rol coincida
        if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
            return res.status(403).json({ 
                message: "Acceso denegado: No tienes los permisos requeridos para esta acción" 
            });
        }
        next();
    };
};

// 3. Exportar AMBAS funciones (Si en otros archivos lo importas como 'verificarToken', dejamos ambos alias)
module.exports = { 
    verifyToken, 
    verificarToken: verifyToken, 
    permitirRoles 
};
};



module.exports = { verifyToken };