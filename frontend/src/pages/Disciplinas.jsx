import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buscarDisciplinas, inscribirse } from '../services/disciplinasService'
import { useAuth } from '../context/AuthContext'

export default function Disciplinas() {
  const { usuario } = useAuth()
  const [filtros, setFiltros] = useState({ nombre: '', categoria: '', ubicacion: '' })
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState(null)
  const [inscribiendoId, setInscribiendoId] = useState(null)

  const cargar = async (f) => {
    try {
      const res = await buscarDisciplinas(f)
      setLista(res.data.data)
      setError('')
    } catch {
      setLista([])
      setError('No se pudieron cargar las disciplinas. Intenta nuevamente.')
    } finally {
      setCargando(false)
    }
  }

  const solicitarCarga = (f) => {
    setCargando(true)
    setError('')
    cargar(f)
  }

  useEffect(() => {
    let activo = true
    buscarDisciplinas({})
      .then((res) => {
        if (activo) setLista(res.data.data)
      })
      .catch(() => {
        if (activo) {
          setLista([])
          setError('No se pudieron cargar las disciplinas. Intenta nuevamente.')
        }
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [])

  const buscar = (e) => {
    e.preventDefault()
    setMensaje(null)
    solicitarCarga(filtros)
  }

  const limpiar = () => {
    const vacio = { nombre: '', categoria: '', ubicacion: '' }
    setFiltros(vacio)
    setMensaje(null)
    solicitarCarga(vacio)
  }

  const inscribir = async (id) => {
    setMensaje(null)
    setInscribiendoId(id)
    try {
      const res = await inscribirse(id)
      setMensaje({ tipo: 'ok', texto: res.data.message })
      setCargando(true)
      await cargar(filtros)
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.message || 'No se pudo realizar la inscripción' })
    } finally {
      setInscribiendoId(null)
    }
  }

  return (
    <main className="offer-page">
      <div className="offer-container">
        <header className="offer-page-heading">
          <span className="offer-eyebrow">SIVEC / Oferta comunitaria</span>
          <h1>Disciplinas deportivas y culturales</h1>
          <p>Encuentra actividades disponibles, consulta los cupos y explora dónde se practican.</p>
        </header>

        <form onSubmit={buscar} className="offer-filter-panel">
          <div className="offer-filter-heading">
            <div>
              <h2>Explorar oferta</h2>
              <p>Combina los filtros para encontrar una actividad.</p>
            </div>
            <span className="offer-filter-mark" aria-hidden="true">⌕</span>
          </div>
          <div className="offer-filter-grid offer-filter-grid-three">
            <label className="offer-field">
              <span>Nombre de la disciplina</span>
              <input
                type="search"
                placeholder="Ej. fútbol"
                value={filtros.nombre}
                onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })}
              />
            </label>
            <label className="offer-field">
              <span>Categoría</span>
              <select
                value={filtros.categoria}
                onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
              >
                <option value="">Todas las categorías</option>
                <option value="DEPORTIVA">Deportiva</option>
                <option value="CULTURAL">Cultural</option>
              </select>
            </label>
            <label className="offer-field">
              <span>Ubicación o escenario</span>
              <input
                type="search"
                placeholder="Nombre del escenario"
                value={filtros.ubicacion}
                onChange={(e) => setFiltros({ ...filtros, ubicacion: e.target.value })}
              />
            </label>
          </div>
          <div className="offer-filter-actions">
            <button className="offer-button offer-button-primary" disabled={cargando}>
              {cargando ? 'Buscando…' : 'Buscar oferta'}
            </button>
            <button type="button" onClick={limpiar} className="offer-button offer-button-secondary" disabled={cargando}>
              Limpiar filtros
            </button>
          </div>
        </form>

        {mensaje && (
          <p className={`offer-notice ${mensaje.tipo}`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>
            {mensaje.texto}
          </p>
        )}

        <section aria-labelledby="offer-results-title">
          <div className="offer-results-heading">
            <div>
              <h2 id="offer-results-title">Actividades disponibles</h2>
              <p>La información se consulta desde la oferta publicada en SIVEC.</p>
            </div>
            {!cargando && !error && <span className="offer-result-count">{lista.length} resultados</span>}
          </div>

          {cargando && <div className="offer-state" role="status">Cargando disciplinas…</div>}
          {!cargando && error && (
            <div className="offer-state offer-state-error" role="alert">
              <strong>No fue posible mostrar la oferta</strong>
              <p>{error}</p>
              <button className="offer-button offer-button-secondary" onClick={() => solicitarCarga(filtros)} type="button">
                Reintentar
              </button>
            </div>
          )}
          {!cargando && !error && lista.length === 0 && (
            <div className="offer-state">
              <strong>No hay resultados para estos filtros</strong>
              <p>Prueba con otros términos o limpia los filtros para ver toda la oferta.</p>
            </div>
          )}

          {!cargando && !error && lista.length > 0 && (
            <div className="offer-card-grid">
              {lista.map((d) => {
                const disponibles = Number(d.cupo_maximo) - Number(d.inscritos)
                const lleno = disponibles <= 0
                return (
                  <article key={d.id_disciplina} className="offer-card">
                    <div className="offer-card-topline">
                      <span className={`offer-category ${d.categoria === 'DEPORTIVA' ? 'sport' : 'culture'}`}>
                        {d.categoria}
                      </span>
                      <span className={`offer-capacity ${lleno ? 'full' : ''}`}>
                        {lleno ? 'Cupo completo' : `${disponibles} cupos`}
                      </span>
                    </div>
                    <h3>{d.nombre}</h3>
                    <dl className="offer-card-details">
                      <div>
                        <dt>Dirigida a</dt>
                        <dd>{d.poblacion_objetivo || 'Todo público'}</dd>
                      </div>
                      <div>
                        <dt>Escenario</dt>
                        <dd>{d.escenarios || 'Por definir'}</dd>
                      </div>
                      <div>
                        <dt>Inscripciones</dt>
                        <dd>{d.inscritos}/{d.cupo_maximo}</dd>
                      </div>
                    </dl>
                    {usuario?.rol === 'DEPORTISTA' && (
                      <button
                        type="button"
                        onClick={() => inscribir(d.id_disciplina)}
                        disabled={lleno || inscribiendoId !== null}
                        className="offer-button offer-button-primary offer-card-button"
                      >
                        {inscribiendoId === d.id_disciplina
                          ? 'Procesando…'
                          : lleno
                            ? 'Cupo completo'
                            : 'Inscribirme'}
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {!usuario && (
          <aside className="offer-sign-in">
            <span>¿Quieres participar?</span>
            <p>Inicia sesión con una cuenta de deportista para solicitar una inscripción.</p>
            <Link to="/login" className="offer-text-link">Iniciar sesión</Link>
          </aside>
        )}
      </div>
    </main>
  )
}
