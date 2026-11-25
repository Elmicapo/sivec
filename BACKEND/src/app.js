const path = require('node:path');
const express = require('express');
const cors = require('cors');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const disciplinasRoutes = require('./routes/disciplinas.routes');
const escenariosRoutes = require('./routes/escenarios.routes');
const reportesRoutes = require('./routes/reportes.routes'); 
const agendaRoutes = require('./routes/agenda.routes');


const app = express();

// Middlewares globales
app.use(cors()); 
app.use(express.json({ limit: '28mb' }));

// La PWA guarda solo las consultas públicas que enumera el service worker.
app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Rutas base de la API
app.use('/api/auth', authRoutes);
app.use('/api/disciplinas', disciplinasRoutes);
app.use('/api/pruebas', require('./routes/pruebas.routes'));
app.use('/api/escenarios', escenariosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/entrenadores', require('./routes/entrenadores.routes'));
app.use('/api/cronogramas', require('./routes/cronogramas.routes'));
app.use('/api/inscripciones', require('./routes/inscripciones.routes'));
app.use('/api/agenda', agendaRoutes);

const estadoApi = (_req, res) => {
    res.json({ message: "API del Sistema Deportivo y Cultural operando." });
};

app.get('/api/health', estadoApi);
app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, message: 'Ruta de API no encontrada.' });
});

if (process.env.SIVEC_WEB_DIR) {
    const directorioWeb = path.resolve(process.env.SIVEC_WEB_DIR);
    app.use(express.static(directorioWeb));
    app.get(/.*/, (req, res, next) => {
        if (!req.headers.accept?.includes('text/html')) return next();
        res.sendFile(path.join(directorioWeb, 'index.html'));
    });
} else {
    app.get('/', estadoApi);
}

module.exports = app;
