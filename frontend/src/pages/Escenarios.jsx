import { useCallback, useEffect, useState } from 'react'
import useActualizarLista from '../hooks/useActualizarLista'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getEscenarios, getDisciplinasActivas } from '../services/deportesService'
import { getAgenda } from '../services/entrenadoresService'
import escenariosIlustrativos from '../assets/escenarios-ilustrativos.webp'
import actividadesIlustrativas from '../assets/actividades-ilustrativas.webp'

const FOTO_ESTADIO = 'https://indeportesantioquia.gov.co/wp-content/uploads/2022/10/Estadio-y-ciudad-de-Apartado.jpeg'
const [fotoLocal] = Object.values(import.meta.glob('../assets/estadio-apartado.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
  query: '?url'
}))

const ESTADOS = [
  { codigo: 'VERDE', nombre: 'Buen estado' },
  { codigo: 'AMARILLO', nombre: 'En mantenimiento' },
  { codigo: 'ROJO', nombre: 'Deteriorado' }
]

const FOTOS_ACTIVIDADES = {
  futbol: { posicion: '0% 0%', alt: 'Entrenamiento de fútbol al aire libre' },
  danza: { posicion: '100% 0%', alt: 'Ensayo de danza folclórica' },
  deportiva: { posicion: '100% 100%', alt: 'Actividad física comunitaria' }
}

function FotoIlustrativa({ foto, className = '' }) {
  return <div
    role="img"
    aria-label={`${foto.alt}, imagen ilustrativa`}
    className={`home-photo-tile ${className}`}
    style={{ backgroundImage: `url(${actividadesIlustrativas})`, backgroundPosition: foto.posicion }}
  />
}

const ICONOS = {
  flecha: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  cancha: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16M3 12h4a5 5 0 0 0 0-8m14 8h-4a5 5 0 0 1 0-8" />
      <path d="M3 12h4a5 5 0 0 1 0 8m14-8h-4a5 5 0 0 0 0 8" />
    </>
  ),
  comunidad: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  ubicacion: (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  pulso: (
    <>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </>
  ),

}

function Icono({ nombre, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      {ICONOS[nombre]}
    </svg>
  )
}

function EstadoCarga({ etiqueta }) {
  return (
    <div aria-label={`Cargando ${etiqueta}`} className="home-skeleton" role="status">
      <span />
      <span />
      <span />
    </div>
  )
}

function EstadoVacio({ titulo, detalle, accion }) {
  return (
    <div className="home-empty">
      <span className="home-empty-mark" aria-hidden="true">—</span>
      <h3>{titulo}</h3>
      <p>{detalle}</p>
      {accion}
    </div>
  )
}

function imagenDeEscenario({ tipo, nombre }) {
  const texto = `${tipo || ''} ${nombre || ''}`.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  if (/piscina|acuatic|natacion/.test(texto)) return { posicion: '100% 100%', alt: 'Piscina deportiva' }
  if (/coliseo|cubierta|techad/.test(texto)) return { posicion: '100% 0%', alt: 'Cancha polideportiva cubierta' }
  if (/estadio|futbol/.test(texto)) return { posicion: '0% 0%', alt: 'Cancha de fútbol con pista' }
  return { posicion: '0% 100%', alt: 'Cancha deportiva al aire libre' }
}

function TarjetaEscenario({ escenario }) {
  const codigo = escenario.estado_semaforo
  const imagen = imagenDeEscenario(escenario)

  return (
    <article className="home-venue-card">
      <figure className="home-venue-visual">
        <div
          aria-label={`${imagen.alt}, imagen ilustrativa`}
          className="home-venue-image"
          role="img"
          style={{ backgroundImage: `url(${escenariosIlustrativos})`, backgroundPosition: imagen.posicion }}
        />
        <figcaption>Imagen ilustrativa</figcaption>
      </figure>
      <div className="home-venue-card-top">
        <span className={`home-status-pill home-status-${codigo?.toLowerCase() || 'unknown'}`}>
          <span className="home-status-dot" />
          {ESTADOS.find((estado) => estado.codigo === codigo)?.nombre || 'Estado no disponible'}
        </span>
      </div>
      <h3>{escenario.nombre}</h3>
      <p className="home-venue-meta">
        <Icono nombre="ubicacion" />
        <span>{escenario.ubicacion || 'Ubicación no disponible'}</span>
      </p>
      <div className="home-venue-card-bottom">
        <span>{escenario.tipo || 'Tipo no disponible'}</span>
        {escenario.capacidad_aforo != null && (
          <span>{escenario.capacidad_aforo} personas</span>
        )}
      </div>
      <Link className="home-card-link" to="/reportar">Reportar el estado</Link>
    </article>
  )
}

function TarjetaDisciplina({ disciplina }) {
  const disponibles = Number(disciplina.cupo_maximo) - Number(disciplina.inscritos)
  const foto = disciplina.categoria === 'CULTURAL'
    ? FOTOS_ACTIVIDADES.danza
    : FOTOS_ACTIVIDADES.deportiva

  return (
    <article className="home-discipline-card">
      <FotoIlustrativa foto={foto} className="home-discipline-photo" />
      <span className={`home-discipline-icon ${disciplina.categoria === 'CULTURAL' ? 'home-discipline-icon-culture' : ''}`}>
        <Icono nombre="comunidad" />
      </span>
      <div className="home-discipline-content">
        <span className={`home-discipline-category ${disciplina.categoria === 'CULTURAL' ? 'home-discipline-category-culture' : ''}`}>
          {disciplina.categoria}
        </span>
        <span className="home-discipline-photo-label">Imagen ilustrativa de la categoría</span>
        <h3>{disciplina.nombre}</h3>
        <p>{disciplina.poblacion_objetivo || 'Población objetivo no especificada'}</p>
        {disciplina.entrenador && (
          <p className="home-discipline-coach">Entrenador: {disciplina.entrenador}</p>
        )}
        <div className="home-availability">
          <span className="home-availability-track">
            <span
              style={{
                width: `${disciplina.cupo_maximo > 0
                  ? Math.min(100, Math.max(0, (Number(disciplina.inscritos) / Number(disciplina.cupo_maximo)) * 100))
                  : 0}%`,
              }}
            />
          </span>
          <span>
            {Number.isFinite(disponibles) && disponibles >= 0
              ? `${disponibles} cupos disponibles`
              : 'Consulta los cupos'}
          </span>
        </div>
      </div>
      <Link aria-label={`Consultar oferta de ${disciplina.nombre}`} className="home-discipline-arrow" to="/disciplinas">
        <Icono nombre="flecha" />
      </Link>
    </article>
  )
}

function solicitarDatosPortada() {
  return Promise.allSettled([
    getEscenarios(),
    getDisciplinasActivas(),
    getAgenda(),
  ])
}

export default function Escenarios() {
  const [errorFotoEstadio, setErrorFotoEstadio] = useState(false)
  const { usuario } = useAuth()
  const [escenarios, setEscenarios] = useState([])
  const [disciplinas, setDisciplinas] = useState([])
  const [cronogramas, setCronogramas] = useState([])
  const [estadoEscenarios, setEstadoEscenarios] = useState('loading')
  const [estadoDisciplinas, setEstadoDisciplinas] = useState('loading')
  const [estadoCronogramas, setEstadoCronogramas] = useState('loading')

  const aplicarResultados = useCallback(([resultadoEscenarios, resultadoDisciplinas, resultadoCronogramas]) => {
    if (resultadoEscenarios.status === 'fulfilled') {
      setEscenarios(resultadoEscenarios.value.data.data || [])
      setEstadoEscenarios('success')
    } else {
      setEstadoEscenarios('error')
    }

    if (resultadoDisciplinas.status === 'fulfilled') {
      setDisciplinas(resultadoDisciplinas.value.data.data || [])
      setEstadoDisciplinas('success')
    } else {
      setEstadoDisciplinas('error')
    }

    if (resultadoCronogramas.status === 'fulfilled') {
      setCronogramas(resultadoCronogramas.value.data.data || [])
      setEstadoCronogramas('success')
    } else {
      setEstadoCronogramas('error')
    }
  }, [])

  useEffect(() => {
    let activo = true
    solicitarDatosPortada().then((resultados) => {
      if (activo) aplicarResultados(resultados)
    })

    return () => {
      activo = false
    }
  }, [aplicarResultados])

  useActualizarLista(async () => {
    aplicarResultados(await solicitarDatosPortada())
  }, true)

  const reintentar = () => {
    setEstadoEscenarios('loading')
    setEstadoDisciplinas('loading')
    setEstadoCronogramas('loading')
    solicitarDatosPortada().then(aplicarResultados)
  }

  const conteoPorEstado = (codigo) =>
    estadoEscenarios === 'success'
      ? escenarios.filter((escenario) => escenario.estado_semaforo === codigo).length
      : null

  const disciplinasDestacadas = disciplinas.slice(0, 4)
  const escenariosDestacados = escenarios.slice(0, 3)
  const cronogramasDestacados = cronogramas.slice(0, 4)

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-grid" aria-hidden="true" />
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <span className="home-eyebrow"><span /> Oferta deportiva y cultural municipal</span>
            <h1>
              El deporte y la cultura
              <span> nos unen.</span>
            </h1>
            <p className="home-hero-description">
              Descubre la oferta deportiva y cultural del municipio, conoce nuestros
              escenarios y participa en la construcción de espacios seguros y adecuados para todos.
            </p>
            <div className="home-hero-actions">
              <Link className="home-button home-button-primary" to="/disciplinas">
                Explorar disciplinas <Icono nombre="flecha" />
              </Link>
              <Link className="home-button home-button-quiet" to="/#estado-escenarios">
                Conocer nuestros escenarios
              </Link>
            </div>
            <div className="home-hero-note">
              <Icono nombre="pulso" />
              <span>Deporte, cultura y participación para todas las comunidades</span>
            </div>
          </div>

          <div className="home-hero-art">
            <figure className="home-hero-photo">
              <FotoIlustrativa foto={FOTOS_ACTIVIDADES.futbol} />
              <figcaption>
                <span>Espacios para encontrarnos</span>
                <strong>Una comunidad en movimiento</strong>
              </figcaption>
            </figure>
            <figure className="home-culture-photo">
              <FotoIlustrativa foto={FOTOS_ACTIVIDADES.danza} />
              <figcaption>La cultura también nos une</figcaption>
            </figure>
          </div>
        </div>

        <div className="home-hero-bottom">
          <span>Conoce la oferta y participa en tu comunidad</span>
          <a href="#estado-escenarios" aria-label="Desplazarse al estado de los escenarios">
            <span />
          </a>
        </div>
      </section>

      <section aria-labelledby="home-state-title" className="home-section home-state-section" id="estado-escenarios">
        <div className="home-section-heading">
          <div>
            <span className="home-kicker">Apartadó · Antioquia</span>
            <h2 id="home-state-title">Escenarios deportivos de nuestro municipio</h2>
            <p>Consulta la información publicada y el estado del semáforo de cada escenario.</p>
          </div>
          <Link className="home-text-link" to="/reportar">Reportar un estado <Icono nombre="flecha" /></Link>
        </div>

        <div className="home-status-summary" aria-live="polite">
          {ESTADOS.map((estado) => (
            <div className="home-status-count" key={estado.codigo}>
              <span className={`home-status-dot home-dot-${estado.codigo.toLowerCase()}`} />
              <span>{estado.nombre}</span>
              <strong>
                {estadoEscenarios === 'loading'
                  ? '…'
                  : estadoEscenarios === 'error'
                    ? '—'
                    : conteoPorEstado(estado.codigo)}
              </strong>
            </div>
          ))}
          <div className="home-status-total">
            <span>Escenarios disponibles</span>
            <strong>
              {estadoEscenarios === 'loading'
                ? '…'
                : estadoEscenarios === 'error'
                  ? '—'
                  : escenarios.length}
            </strong>
          </div>
        </div>

        {estadoEscenarios === 'loading' && <EstadoCarga etiqueta="escenarios" />}
        {estadoEscenarios === 'error' && (
          <EstadoVacio
            titulo="No pudimos cargar los escenarios"
            detalle="Intenta de nuevo en un momento."
            accion={<button className="home-inline-action" onClick={reintentar} type="button">Reintentar</button>}
          />
        )}
        {estadoEscenarios === 'success' && escenarios.length === 0 && (
          <EstadoVacio
            titulo="Aún no hay escenarios para mostrar"
            detalle="Cuando se publique información, podrás consultarla aquí."
          />
        )}
        {estadoEscenarios === 'success' && escenarios.length > 0 && (
          <div className="home-venue-grid">
            {escenariosDestacados.map((escenario) => (
              <TarjetaEscenario escenario={escenario} key={escenario.id_escenario} />
            ))}
          </div>
        )}
        {estadoEscenarios === 'success' && escenarios.length > escenariosDestacados.length && (
          <p className="home-section-footnote">Mostrando {escenariosDestacados.length} de {escenarios.length} escenarios publicados. Consulta el listado completo para ver los demás.</p>
        )}
      </section>

      <section aria-labelledby="home-offer-title" className="home-offer-section">
        <div className="home-section home-offer-inner">
          <div className="home-section-heading">
            <div>
              <span className="home-kicker home-kicker-green">Apartadó · Antioquia</span>
              <h2 id="home-offer-title">Descubre todo lo que tenemos para ti</h2>
              <p>Encuentra actividades deportivas y culturales para diferentes edades y comunidades.</p>
            </div>
            <Link className="home-text-link" to="/disciplinas">
              Ver toda la oferta <Icono nombre="flecha" />
            </Link>
          </div>

          {estadoDisciplinas === 'loading' && <EstadoCarga etiqueta="la oferta" />}
          {estadoDisciplinas === 'error' && (
            <EstadoVacio
              titulo="La oferta no está disponible ahora"
              detalle="Puedes volver a intentarlo sin salir de esta página."
              accion={<button className="home-inline-action" onClick={reintentar} type="button">Reintentar</button>}
            />
          )}
          {estadoDisciplinas === 'success' && disciplinas.length === 0 && (
            <EstadoVacio
              titulo="No hay disciplinas activas para mostrar"
              detalle="Consulta nuevamente más adelante."
            />
          )}
          {estadoDisciplinas === 'success' && disciplinas.length > 0 && (
            <div className="home-discipline-grid">
              {disciplinasDestacadas.map((disciplina) => (
                <TarjetaDisciplina disciplina={disciplina} key={disciplina.id_disciplina} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="home-schedule-title" className="home-schedule-section" id="cronogramas">
        <div className="home-section">
          <div className="home-section-heading">
            <div>
              <span className="home-kicker home-kicker-green">Agenda de Apartadó</span>
              <h2 id="home-schedule-title">Organiza tu tiempo y participa</h2>
              <p>Consulta horarios, disciplinas, entrenadores y escenarios disponibles.</p>
            </div>
            {['ADMINISTRATIVO', 'ENTRENADOR'].includes(usuario?.rol) && (
              <Link className="home-text-link" to="/cronogramas">
                Gestión de cronogramas <Icono nombre="flecha" />
              </Link>
            )}
          </div>
          {estadoCronogramas === 'loading' && <EstadoCarga etiqueta="los cronogramas" />}
          {estadoCronogramas === 'error' && (
            <EstadoVacio
              titulo="No pudimos cargar los cronogramas"
              detalle="Intenta de nuevo en un momento."
              accion={<button className="home-inline-action" onClick={reintentar} type="button">Reintentar</button>}
            />
          )}
          {estadoCronogramas === 'success' && cronogramas.length === 0 && (
            <EstadoVacio
              titulo="Aún no hay horarios publicados"
              detalle="Cuando se publiquen actividades, aparecerán aquí."
            />
          )}
          {estadoCronogramas === 'success' && cronogramas.length > 0 && (
            <div className="home-schedule-grid">
              {cronogramasDestacados.map((cronograma) => (
                <article className="home-schedule-card" key={cronograma.id_cronograma}>
                  <span className="home-schedule-day">{cronograma.dia_semana}</span>
                  <h3>{cronograma.disciplina}</h3>
                  <p className="home-schedule-time">
                    {String(cronograma.hora_inicio).slice(0, 5)} – {String(cronograma.hora_fin).slice(0, 5)}
                  </p>
                  <dl>
                    <div><dt>Entrenador</dt><dd>{cronograma.entrenador || 'No especificado'}</dd></div>
                    <div><dt>Escenario</dt><dd>{cronograma.escenario || 'No especificado'}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          )}
          <p className="home-section-footnote">
            La gestión de cronogramas está disponible para entrenadores y usuarios administrativos autorizados.
          </p>
        </div>
      </section>

      <section aria-labelledby="home-community-title" className="home-community-section">
        <div className="home-community-inner">
          <figure className="home-community-visual">
            {errorFotoEstadio ? (
              <div
                role="img"
                aria-label="Cancha de fútbol con pista, imagen ilustrativa"
                className="home-photo-tile"
                style={{ backgroundImage: `url(${escenariosIlustrativos})`, backgroundPosition: '0% 0%' }}
              />
            ) : (
              <img
                alt="Vista aérea del estadio de Apartadó, con la cancha, la pista y la ciudad al fondo"
                className="block h-auto w-full"
                decoding="async"
                height={660}
                loading="lazy"
                onError={() => setErrorFotoEstadio(true)}
                src={fotoLocal || FOTO_ESTADIO}
                width={1280}
              />
            )}
            <figcaption>
              {errorFotoEstadio ? 'Imagen ilustrativa · Fotografía original: ' : 'Estadio y ciudad de Apartadó · '}<a href={FOTO_ESTADIO} target="_blank" rel="noreferrer">Indeportes Antioquia</a>
            </figcaption>
          </figure>

          <div className="home-community-copy">
            <span className="home-kicker">Veeduría ciudadana · Apartadó</span>
            <h2 id="home-community-title">Tu participación transforma nuestros escenarios</h2>
            <p>
              Ayúdanos a cuidar los espacios deportivos del municipio. Tu reporte contribuye
              a que la comunidad conozca su estado.
            </p>
            <div className="home-community-status" aria-label="Estados del semáforo">
              {ESTADOS.map((estado) => (
                <span className={`home-community-status-item home-community-status-${estado.codigo.toLowerCase()}`} key={estado.codigo}>
                  <span className="home-status-dot" />
                  {estado.nombre}
                </span>
              ))}
            </div>
            <div className="home-community-actions">
              <Link className="home-button home-button-primary" to="/reportar">
                Reportar el estado de un escenario <Icono nombre="flecha" />
              </Link>
              <Link className="home-button home-button-community-secondary" to="/historico-reportes">
                Consultar histórico de reportes
              </Link>
            </div>
            <p className="home-community-note">Acceso para el CMJ y usuarios administrativos.</p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <Link aria-label="SIVEC, inicio" className="home-footer-brand" to="/">
          <span className="home-brand-mark">S</span>
          <span><strong>SIVEC</strong><small>Apartadó, Antioquia</small></span>
        </Link>
        <p>Sistema de Información, Veeduría y Espacios para el Deporte y la Cultura de Apartadó, Antioquia, Colombia.</p>
        <p className="home-footer-disclaimer">Proyecto académico. No representa un portal oficial de la Alcaldía de Apartadó ni del CMJ.</p>
        <div className="home-footer-links">
          <Link to="/disciplinas">Disciplinas</Link>
          <Link to="/#estado-escenarios">Escenarios</Link>
          <Link to="/#cronogramas">Cronogramas</Link>
          <Link to="/reportar">Veeduría</Link>
          <Link to="/historico-reportes">Histórico de reportes</Link>
          <Link to="/login">Iniciar sesión</Link>
          <Link to="/registro">Registrarse</Link>
        </div>
      </footer>
    </main>
  )
}
