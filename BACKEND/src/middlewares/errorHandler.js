const { registrarError } = require('../utils/safeError');

const errorHandler = (err, req, res, next) => {
    registrarError('http.unhandled', err);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        error: {
            message: statusCode >= 500 ? 'Error interno del servidor' : (err.publicMessage || 'Error al procesar la solicitud')
        }
    });
};

module.exports = errorHandler;