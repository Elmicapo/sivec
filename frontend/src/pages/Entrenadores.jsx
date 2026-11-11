import { useEffect, useState } from 'react'
import { buscarEntrenadores, getAgenda } from '../services/entrenadoresService'
import TablaAgenda from '../components/TablaAgenda'

export default function Entrenadores() {
  const [filtros, setFiltros] = useState({ nombre: '', deporte: '' })
  const [lista, setLista] = useState([])
  const [seleccionado, setSeleccionado] = useState(null)
  const [agenda, setAgenda] = useState([])
  const [error, setError] = useState('')
  const [agendaError, setAgendaError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [cargandoAgenda, setCargandoAgenda] = useState(false)

  const cargar = async (f) => {
    try {
      const res = await buscarEntrenadores(f)
      setLista(res.data.data)
      setError('')
    } catch {
      setLista([])
      setError('No se pudieron cargar los entrenadores. Intenta nuevamente.')
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
    buscarEntrenadores({})
      .then((res) => {
        if (activo) setLista(res.data.data)
      })
      .catch(() => {
        if (activo) {
          setLista([])
          setError('No se pudieron cargar los entrenadores. Intenta nuevamente.')
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
    setSeleccionado(null)
    setAgenda([])
    setAgendaError('')
    solicitarCarga(filtros)
  }

  const limpiar = () => {
    const vacio = { nombre: '', deporte: '' }
    setFiltros(vacio)
    setSeleccionado(null)
    setAgenda([])
    solicitarCarga(vacio)
  }

  const verHorarios = async (t) => {
    setSeleccionado(t)
    setAgenda([])
    setError('')
    setAgendaError('')
    setCargandoAgenda(true)
    try {
      const res = await getAgenda({ id_entrenador: t.id_persona })
      setAgenda(res.data.data)
    } catch {
      setAgendaError('No se pudo cargar la agenda de este entrenador.')
    } finally {
      setCargandoAgenda(false)
    }
  }

  return (
    <main className="offer-page">
      <div className="offer-container">
        <header className="offer-page-heading">
          <span className="offer-eyebrow">SIVEC / Equipo deportivo</span>
          <h1>Encuentra un entrenador</h1>
          <p>Busca por nombre o disciplina y consulta los horarios registrados.</p>
        </header>

        <form onSubmit={buscar} className="offer-filter-panel">
          <div className="offer-filter-heading">
            <div>
              <h2>Buscar entrenadores</h2>
              <p>Usa uno o ambos campos para afinar los resultados.</p>
            </div>
          </div>
          <div className="offer-filter-grid offer-filter-grid-two">
            <label className="offer-field">
              <span>Nombre</span>
              <input
                type="search"
                placeholder="Nombre del entrenador"
                value={filtros.nombre}
                onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })}
              />
            </label>
            <label className="offer-field">
              <span>Disciplina</span>
              <input
                type="search"
                placeholder="Ej. fútbol"
                value={filtros.deporte}
                onChange={(e) => setFiltros({ ...filtros, deporte: e.target.value })}
              />
            </label>
          </div>
          <div className="offer-filter-actions">
            <button className="offer-button offer-button-primary" disabled={cargando}>
              {cargando ? 'Buscando…' : 'Buscar'}
            </button>
            <button type="button" onClick={limpiar} className="offer-button offer-button-secondary" disabled={cargando}>
              Limpiar filtros
            </button>
          </div>
        </form>

        <section aria-labelledby="trainers-results-title">
          <div className="offer-results-heading">
            <div>
              <h2 id="trainers-results-title">Entrenadores registrados</h2>
              <p>Selecciona un perfil para consultar sus horarios.</p>
            </div>
            {!cargando && !error && <span className="offer-result-count">{lista.length} resultados</span>}
          </div>
          {cargando && <div className="offer-state" role="status">Cargando entrenadores…</div>}
          {!cargando && error && (
            <div className="offer-state offer-state-error" role="alert">
              <strong>No fue posible completar la consulta</strong>
              <p>{error}</p>
              {!cargandoAgenda && <button className="offer-button offer-button-secondary" onClick={() => solicitarCarga(filtros)} type="button">Reintentar búsqueda</button>}
            </div>
          )}
          {!cargando && !error && lista.length === 0 && (
            <div className="offer-state">
              <strong>No hay entrenadores que coincidan</strong>
              <p>Prueba con otro nombre o disciplina, o limpia los filtros.</p>
            </div>
          )}
          {!cargando && !error && lista.length > 0 && (
            <div className="offer-card-grid">
              {lista.map((t) => (
                <article
                  key={t.id_persona}
                  className={`offer-card trainer-card ${seleccionado?.id_persona === t.id_persona ? 'selected' : ''}`}
                >
                  <span className="trainer-card-mark" aria-hidden="true">
                    {(t.nombre_completo || 'E').trim().charAt(0).toUpperCase()}
                  </span>
                  <h3>{t.nombre_completo}</h3>
                  <dl className="offer-card-details">
                    <div>
                      <dt>Disciplinas</dt>
                      <dd>{t.deportes || 'Sin disciplinas asignadas'}</dd>
                    </div>
                    {t.correo_electronico && (
                      <div>
                        <dt>Correo</dt>
                        <dd>{t.correo_electronico}</dd>
                      </div>
                    )}
                  </dl>
                  <button
                    type="button"
                    onClick={() => verHorarios(t)}
                    disabled={cargandoAgenda}
                    className="offer-button offer-button-primary offer-card-button"
                  >
                    {cargandoAgenda && seleccionado?.id_persona === t.id_persona
                      ? 'Cargando horarios…'
                      : seleccionado?.id_persona === t.id_persona
                        ? 'Ver horarios seleccionados'
                        : 'Consultar horarios'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {seleccionado && (
          <section className="offer-agenda-section" aria-labelledby="trainer-agenda-title">
            <div className="offer-results-heading">
              <div>
                <span className="offer-eyebrow">Agenda</span>
                <h2 id="trainer-agenda-title">Horarios de {seleccionado.nombre_completo}</h2>
              </div>
            </div>
            {cargandoAgenda && <div className="offer-state" role="status">Cargando horarios…</div>}
            {!cargandoAgenda && !error && (
              <TablaAgenda filas={agenda} vacio="Este entrenador no tiene horarios registrados." />
            )}
            {agendaError && (
              <div className="offer-state offer-state-error" role="alert">
                <strong>No fue posible cargar los horarios</strong>
                <p>{agendaError}</p>
                <button className="offer-button offer-button-secondary" onClick={() => verHorarios(seleccionado)} type="button">
                  Reintentar
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
