import API from './api';

// Autenticación
export const loginUser = (credentials) => API.post('/auth/login', credentials);

// Disciplinas
export const getDisciplinasActivas = () => API.get('/disciplinas/activas');

// Escenarios y Semáforos
export const getEscenarios = () => API.get('/escenarios');
export const crearReporteVeeduria = (reporteData) => API.post('/escenarios/reportes', reporteData);