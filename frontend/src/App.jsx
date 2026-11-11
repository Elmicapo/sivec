import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import RutaProtegida from './components/RutaProtegida';
import Escenarios from './pages/Escenarios';
import Disciplinas from './pages/Disciplinas';
import Reportar from './pages/Reportar';
import AdminDisciplinas from './pages/AdminDisciplinas';
import SolicitudesEntrenadores from './pages/SolicitudesEntrenadores';
import MiHistorial from './pages/MiHistorial';
import PanelCMJ from './pages/PanelCMJ';
import Entrenadores from './pages/Entrenadores';
import Cronogramas from './pages/Cronogramas';
import PanelEntrenador from './pages/PanelEntrenador';
import MisSolicitudesEntrenador from './pages/MisSolicitudesEntrenador';
import SeguimientoVeeduria from './pages/SeguimientoVeeduria';
import ScrollToTop from './components/ScrollToTop';
import AdministrarAgenda from './pages/AdministrarAgenda';

// Componente validador de Roles
const RutaAdministrativa = ({ children }) => {
    const token = localStorage.getItem('token');
    const usuarioString = localStorage.getItem('usuario');
    let esAdmin = false;
    
    if (usuarioString) {
        try {
            const usuario = JSON.parse(usuarioString);
            esAdmin = usuario.rol === 'ADMINISTRATIVO';
        } catch (e) {}
    }

    if (!token || !esAdmin) {
        return <Navigate to="/" />; 
    }
    return children;
};

function App() {
  const location = useLocation();
  const authMode = location.pathname === '/registro'
    ? 'registro'
    : location.pathname === '/login'
      ? 'login'
      : null;
      
  const backgroundLocation = authMode
    ? location.state?.backgroundLocation || { ...location, pathname: '/', search: '', hash: '' }
    : location;

  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Routes location={backgroundLocation}>
        {/* Vistas Públicas */}
        <Route path="/" element={<Escenarios />} />
        <Route path="/disciplinas" element={<Disciplinas />} />
        <Route path="/reportar" element={<Reportar />} />
        <Route path="/seguimiento" element={<SeguimientoVeeduria />} />

        {/* --- NUEVA VISTA ADMINISTRATIVA DE CRONOGRAMAS --- */}
        <Route 
            path="/panel-admin" 
            element={
                <RutaAdministrativa>
                    <Navigate to="/cronogramas" replace />
                </RutaAdministrativa>
            } 
        />

        {/* Vistas Protegidas */}
        <Route path="/admin" element={<RutaProtegida roles={['ADMINISTRATIVO']}><AdminDisciplinas /></RutaProtegida>} />
        <Route path="/admin/solicitudes-entrenadores" element={<RutaProtegida roles={['ADMINISTRATIVO']}><SolicitudesEntrenadores /></RutaProtegida>} />
        
        {/* RUTA CORREGIDA: Asignada a ENTRENADOR y ADMINISTRATIVO bajo /entrenador/agenda */}
        <Route 
          path="/entrenador/agenda" 
          element={<RutaProtegida roles={['ENTRENADOR', 'ADMINISTRATIVO']}><AdministrarAgenda /></RutaProtegida>} 
        />

        <Route path="/cronogramas" element={<RutaProtegida roles={['ADMINISTRATIVO', 'ENTRENADOR']}><Cronogramas /></RutaProtegida>} />
        <Route path="/entrenadores" element={<RutaProtegida roles={['ADMINISTRATIVO', 'DEPORTISTA']}><Entrenadores /></RutaProtegida>} />
        <Route path="/entrenador" element={<RutaProtegida roles={['ENTRENADOR']}><PanelEntrenador /></RutaProtegida>} />
        <Route path="/entrenador/solicitudes" element={<RutaProtegida roles={['ENTRENADOR']}><MisSolicitudesEntrenador /></RutaProtegida>} />
        <Route path="/deportista" element={<RutaProtegida roles={['DEPORTISTA']}><MiHistorial /></RutaProtegida>} />
        <Route path="/cmj" element={<RutaProtegida roles={['CMJ']}><PanelCMJ /></RutaProtegida>} />
      </Routes>
      
      {authMode && <AuthModal mode={authMode} />}
    </>
  );
}

export default App;