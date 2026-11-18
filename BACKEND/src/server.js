require('dotenv').config();

const app = require('./app');
const pool = require('./config/db');
const { iniciarColaCorreo } = require('./services/correo.service');
const detenerColaCorreo = iniciarColaCorreo(pool);

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
    console.log(`Servidor ejecutandose en modo ${process.env.NODE_ENV}`);
    console.log(`API REST escuchando en http://localhost:${PORT}`);
});

const cerrar = async () => {
    detenerColaCorreo();
    console.log('Cerrando servidor...');
    await pool.end();
    server.close(() => {
        console.log('Proceso terminado.');
        process.exit(0);
    });
};
process.once('SIGINT', cerrar);
process.once('SIGTERM', cerrar);
