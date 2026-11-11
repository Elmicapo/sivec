function registrarError(contexto, error) {
    console.error(`[${contexto}]`, {
        code: error?.code || 'UNKNOWN_ERROR',
        sqlState: error?.sqlState || undefined,
        message: error?.message || 'Unknown error'
    });
}

function responderErrorInterno(res, contexto, message) {
    return (error) => {
        registrarError(contexto, error);
        return res.status(500).json({ success: false, message });
    };
}

module.exports = { registrarError, responderErrorInterno };
