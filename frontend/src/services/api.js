import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
const API = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para agregar el token automáticamente
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- FUNCIONES EXISTENTES (Si las tenías) ---
// Autenticación
export const loginUser = (credentials) => API.post('/auth/login', credentials);

// Disciplinas
export const getDisciplinasActivas = () => API.get('/disciplinas/activas');

// Escenarios y Semáforos
export const getEscenarios = () => API.get('/escenarios');
export const crearReporteVeeduria = (reporteData) => API.post('/escenarios/reportes', reporteData);


// --- TUS NUEVAS FUNCIONES DE CRONOGRAMA ---

export const crearCronograma = async (datosCronograma) => {
    // Usando fetch como me lo pasaste, aunque podrías usar la instancia "API" de axios que configuramos arriba
    const response = await fetch(`${baseURL}/cronogramas`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(datosCronograma)
    });
    return { data: await response.json() };
};

export const darDeBajaCronograma = async (idCronograma) => {
    // Usando fetch como me lo pasaste
    const response = await fetch(`http://localhost:4000/api/cronogramas/${idCronograma}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });
    return { data: await response.json() };
};

export default API;