import { useEffect, useState } from 'react'
import { miHistorial } from '../services/disciplinasService'

export default function MiHistorial() {
  const [historial, setHistorial] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    miHistorial()
      .then((res) => setHistorial(res.data.data))
      .catch(() => setError('No se pudo cargar tu historial'))
      .finally(() => setCargando(false))
  }, [])

  return (
    <main className="offer-page">
      <div className="offer-container offer-container-narrow">
        <header className="offer-page-heading">
          <span className="offer-eyebrow">SIVEC / Mi actividad</span>
          <h1>Mi historial de inscripciones</h1>
          <p>Consulta las solicitudes registradas para las disciplinas.</p>
        </header>

        {cargando && <div className="offer-state" role="status">Cargando historial…</div>}
        {error && <div className="offer-state offer-state-error" role="alert">{error}</div>}

        {!cargando && !error && (
          <div className="agenda-table-shell">
            <p className="agenda-scroll-hint">Desliza horizontalmente para consultar todas las columnas.</p>
            <div aria-label="Historial de inscripciones" className="agenda-table-scroll" role="region" tabIndex={0}>
            <table className="agenda-table">
              <thead>
                <tr>
                  <th scope="col">Disciplina</th>
                  <th scope="col">Fecha de inscripción</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h, i) => (
                  <tr key={`${h.disciplina}-${h.fecha_inscripcion}-${i}`}>
                    <td className="agenda-day">{h.disciplina}</td>
                    <td>{h.fecha_inscripcion}</td>
                    <td><span className="offer-history-status">{h.estado}</span></td>
                  </tr>
                ))}
                {historial.length === 0 && (
                  <tr><td colSpan="3" className="agenda-empty">Aún no tienes inscripciones.</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}