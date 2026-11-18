import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TablaAgenda from '../components/TablaAgenda'
import { listarCronogramas, misDeportistas } from '../services/entrenadoresService'

function useLista(consultar) {
  const [estado, setEstado] = useState({ cargando: true })
  useEffect(() => {
    let activa = true
    consultar()
      .then(({ data }) => { if (activa) setEstado({ filas: data.data }) })
      .catch(error => {
        if (activa) setEstado({ error: error.response?.data?.message || 'No se pudo cargar esta sección.' })
      })
    return () => { activa = false }
  }, [consultar])
  return estado
}

function Contenido({ estado, children }) {
  if (estado.cargando) return <p className="offer-state" role="status">Cargando…</p>
  if (estado.error) return <p className="offer-notice error" role="alert">{estado.error}</p>
  return children(estado.filas)
}

export default function PanelEntrenador() {
  const agenda = useLista(listarCronogramas)
  const deportistas = useLista(misDeportistas)
  const [busqueda, setBusqueda] = useState('')

  return (
    <main className="offer-page">
      <div className="offer-container space-y-8">
        <header className="offer-page-heading">
          <h1>Panel del entrenador</h1>
          <p>Consulta tus horarios e inscritos en las disciplinas que tienes asignadas.</p>
        </header>

        <section aria-labelledby="agenda-entrenador">
          <header className="offer-results-heading flex-wrap">
            <h2 id="agenda-entrenador">Mi agenda</h2>
            <Link to="/entrenador/agenda" className="offer-button offer-button-secondary">Administrar mi agenda</Link>
          </header>
          <Contenido estado={agenda}>
            {filas => <TablaAgenda filas={filas} vacio="No tienes horarios registrados." />}
          </Contenido>
        </section>

        <section aria-labelledby="inscritos-entrenador">
          <header className="offer-results-heading">
            <h2 id="inscritos-entrenador">Deportistas inscritos</h2>
          </header>
          <Contenido estado={deportistas}>
            {filas => {
              const termino = busqueda.trim().toLocaleLowerCase('es')
              const visibles = filas.filter(fila =>
                [fila.deportista, fila.disciplina].some(texto => texto.toLocaleLowerCase('es').includes(termino))
              )
              return (
                <div className="offer-filter-panel">
                  {filas.length > 0 && (
                    <label className="offer-field mb-4">
                      Buscar por nombre o disciplina
                      <input type="search" value={busqueda} onChange={event => setBusqueda(event.target.value)} />
                    </label>
                  )}
                  {visibles.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase">
                          <tr>{['Disciplina', 'Deportista', 'Fecha de inscripción'].map(titulo => (
                            <th key={titulo} scope="col" className="px-5 py-3">{titulo}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100">
                          {visibles.map(fila => (
                            <tr key={`${fila.id_disciplina}-${fila.id_deportista}`}>
                              <td className="px-5 py-4">{fila.disciplina}</td>
                              <td className="px-5 py-4 font-semibold">{fila.deportista}</td>
                              <td className="px-5 py-4 whitespace-nowrap">{fila.fecha_inscripcion}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p>{filas.length ? 'No hay coincidencias.' : 'No tienes deportistas inscritos en tus disciplinas.'}</p>}
                </div>
              )
            }}
          </Contenido>
        </section>
      </div>
    </main>
  )
}
