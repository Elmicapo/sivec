import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ENLACES_PUBLICOS = [
  ['/disciplinas', 'Disciplinas'],
  ['/#estado-escenarios', 'Escenarios'],
  ['/#cronogramas', 'Cronogramas'],
  ['/reportar', 'Veeduría'],
  ['/seguimiento', 'Seguimiento'],
]

const ENLACES_ROL = {
  ADMINISTRATIVO: [
    ['/admin', 'Administrar oferta'],
    ['/admin/solicitudes-entrenadores', 'Vinculación de entrenadores'],
    ['/entrenadores', 'Entrenadores'],
  ],
  ENTRENADOR: [
    ['/entrenador', 'Mi panel'],
    ['/entrenador/solicitudes', 'Mis solicitudes'],
  ],
  DEPORTISTA: [
    ['/entrenadores', 'Entrenadores'],
    ['/deportista', 'Mi historial'],
  ],
  CMJ: [
    ['/cmj', 'Panel de veeduría'],
  ],
}

function ClaveMarca() {
  return (
    <span className="site-brand-symbol">
      <img src="/branding/SIVEC_isotipo.svg" alt="" />
    </span>
  )
}

export default function Navbar() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [rutaMenuAbierto, setRutaMenuAbierto] = useState(null)
  const ubicacionActual = `${location.pathname}${location.hash}`
  const menuAbierto = rutaMenuAbierto === ubicacionActual

  useEffect(() => {
    const id = location.hash.slice(1)
    if (!id) return

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname, location.hash])

  const salir = () => {
    logout()
    setRutaMenuAbierto(null)
    navigate('/')
  }

  const enlacesRol = usuario ? ENLACES_ROL[usuario.rol] || [] : []
  const rutaActiva = ENLACES_PUBLICOS.some(([ruta]) => ruta === ubicacionActual)
    ? ubicacionActual
    : location.pathname
  const enlaces = [['/', 'Inicio'], ...ENLACES_PUBLICOS, ...enlacesRol]

  return (
    <header className="site-header">
      <nav aria-label="Navegación principal" className="site-nav">
        <div className="site-nav-inner">
          <Link aria-label="SIVEC, página de inicio" className="site-brand" to="/">
            <ClaveMarca />
            <span className="site-brand-copy">
              <strong>SIVEC</strong>
              <small>Sistema de Información, Veeduría y Espacios para el Deporte y la Cultura</small>
            </span>
          </Link>

          <div
            className={`site-nav-content${menuAbierto ? ' site-nav-content-open' : ''}`}
            id="site-navigation"
          >
            <div className="site-nav-links">
              {enlaces.map(([ruta, texto]) => (
                <Link
                  key={ruta}
                  to={ruta}
                  aria-current={rutaActiva === ruta ? (ruta.includes('#') ? 'location' : 'page') : undefined}
                  className={`site-nav-link${rutaActiva === ruta ? ' site-nav-link-active' : ''}`}
                >
                  {texto}
                </Link>
              ))}
            </div>

            <div className="site-nav-account">
              {usuario ? (
                <>
                  <span className="site-nav-user">
                    <span className="site-user-dot" />
                    <span>{usuario.nombre || 'Cuenta activa'}</span>
                    <small>{usuario.rol}</small>
                  </span>
                  <button className="site-nav-login site-nav-logout" onClick={salir} type="button">
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <Link className="site-nav-register" state={{ backgroundLocation: location }} to="/registro">
                    Crear cuenta
                  </Link>
                  <Link className="site-nav-login" state={{ backgroundLocation: location }} to="/login">
                    Iniciar sesión
                  </Link>
                </>
              )}
            </div>
          </div>

          <button
            aria-controls="site-navigation"
            aria-expanded={menuAbierto}
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            className={`site-menu-toggle${menuAbierto ? ' site-menu-toggle-open' : ''}`}
            onClick={() => setRutaMenuAbierto(menuAbierto ? null : ubicacionActual)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>
    </header>
  )
}
