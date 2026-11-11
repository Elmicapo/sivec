const express = require('express');
const cors = require('cors');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const disciplinasRoutes = require('./routes/disciplinas.routes');
const escenariosRoutes = require('./routes/escenarios.routes');
const reportesRoutes = require('./routes/reportes.routes'); 
const agendaRoutes = require('./routes/agendaRoutes');


const app = express();

// Middlewares globales
app.use(cors()); 
app.use(express.json({ limit: '28mb' }));

// Rutas base de la API
app.use('/api/auth', authRoutes);
app.use('/api/disciplinas', disciplinasRoutes);
app.use('/api/escenarios', escenariosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/entrenadores', require('./routes/entrenadores.routes'));
app.use('/api/cronogramas', require('./routes/cronogramas.routes'));
app.use('/api/inscripciones', require('./routes/inscripciones.routes'));
app.use('/api/agenda', agendaRoutes);

// Ruta de prueba inicial
app.get('/', (req, res) => {
    res.json({ message: "API del Sistema Deportivo y Cultural operando." });
});

module.exports = app;