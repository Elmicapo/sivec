import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { miHistorial } from '../services/disciplinasService'
import { borrarHistorialSesion, guardarHistorialSesion, leerHistorialSesion } from '../services/historialSesion'

export default function MiHistorial() {
  const { usuario } = useAuth()
  const idPersona = usuario?.id_persona
  const [consulta, setConsulta] = useState(null)

  useEffect(() => {
    let activa = true
    miHistorial()
      .then(({ data }) => {
        if (!activa) return
        guardarHistorialSesion(idPersona, data.data)
        setConsulta({ idPersona, historial: data.data })
      })
      .catch(error => {
        if (!activa) return
        if ([401, 403].includes(error.response?.status)) borrarHistorialSesion()
        const guardado = error.response ? null : leerHistorialSesion(idPersona)
        setConsulta(guardado
          ? { idPersona, historial: guardado.filas, guardadoEl: guardado.fecha }
          : { idPersona, error: navigator.onLine ? 'No se pudo cargar tu historial.' : 'Tu sesión aún no tiene un historial guardado. Conéctate para consultarlo.' })
      })
    return () => { activa = false }
  }, [idPersona])

  const actual = consulta?.idPersona === idPersona ? consulta : null
  const historial = actual?.historial

  return (
    <main className="offer-page">
      <div className="offer-container offer-container-narrow">
        <header className="offer-page-heading">
          <span className="offer-eyebrow">SIVEC / Mi actividad</span>
          <h1>Mi historial de inscripciones</h1>
          <p>Consulta las solicitudes registradas para las disciplinas.</p>
        </header>

        {!actual && <div className="offer-state" role="status">Cargando historial…</div>}
        {actual?.error && <div className="offer-state offer-state-error" role="alert">{actual.error}</div>}
        {actual?.guardadoEl && <p className="sivec-alert sivec-alert-info mb-4" role="status">
          Historial guardado en esta sesión el {new Date(actual.guardadoEl).toLocaleString('es-CO')}.
        </p>}

        {historial && (
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