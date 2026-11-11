const ORDEN = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']

export default function TablaAgenda({ filas, acciones, vacio = 'No hay horarios registrados.' }) {
  const ordenadas = [...filas].sort(
    (a, b) =>
      ORDEN.indexOf(a.dia_semana) - ORDEN.indexOf(b.dia_semana) ||
      a.hora_inicio.localeCompare(b.hora_inicio)
  )

  return (
    <div className="agenda-table-shell">
      <p className="agenda-scroll-hint">Desliza horizontalmente para consultar todas las columnas.</p>
      <div aria-label="Tabla de horarios" className="agenda-table-scroll" role="region" tabIndex={0}>
      <table className="agenda-table">
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Horario</th>
            <th scope="col">Disciplina</th>
            <th scope="col">Escenario</th>
            <th scope="col">Entrenador</th>
            <th scope="col">Vigencia</th>
            {acciones && <th scope="col">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((f) => (
            <tr key={f.id_cronograma}>
              <td className="agenda-day">{f.dia_semana}</td>
              <td>{f.hora_inicio.slice(0, 5)} - {f.hora_fin.slice(0, 5)}</td>
              <td>{f.disciplina}</td>
              <td>{f.escenario}</td>
              <td>{f.entrenador}</td>
              <td>{f.vigencia_desde} → {f.vigencia_hasta || 'sin cierre'}</td>
              {acciones && <td className="agenda-actions">{acciones(f)}</td>}
            </tr>
          ))}
          {ordenadas.length === 0 && (
            <tr><td colSpan={acciones ? 7 : 6} className="agenda-empty">{vacio}</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}