import { useState } from 'react'
import api from '../services/api'

const pruebas = {
  disciplinas: { ruta: '/disciplinas/prueba-latencia', etiqueta: 'Disciplinas' },
  usuarios: { ruta: '/pruebas/latencia/usuarios', etiqueta: 'Usuarios' }
}

export default function PruebaLatencia() {
  const [tipo, setTipo] = useState('usuarios')
  const [midiendo, setMidiendo] = useState(false)
  const [resultados, setResultados] = useState([])
  const [error, setError] = useState('')

  const medir = async () => {
    setMidiendo(true)
    setResultados([])
    setError('')
    try {
      for (let intento = 0; intento < 3; intento += 1) {
        const inicio = performance.now()
        const respuesta = await api.get(pruebas[tipo].ruta, {
          transformResponse: [texto => texto],
          timeout: 15_000
        })
        const ms = Math.round(performance.now() - inicio)
        const { data } = JSON.parse(respuesta.data)
        if (data?.length !== 10_000) throw new Error(`La respuesta debe contener 10.000 ${tipo}.`)
        setResultados(actuales => [...actuales, ms])
      }
    } catch (fallo) {
      let mensaje = fallo.message
      try {
        if (fallo.response?.data) mensaje = JSON.parse(fallo.response.data).message || mensaje
      } catch {
        mensaje = 'El servidor no devolvió datos de la prueba.'
      }
      setError(mensaje)
    } finally {
      setMidiendo(false)
    }
  }

  return (
    <main className="offer-page">
      <div className="offer-container">
        <header className="offer-page-heading">
          <h1>Prueba de latencia</h1>
          <p>Mide la descarga de 10.000 registros sintéticos desde este dispositivo.</p>
        </header>
        <section className="offer-filter-panel space-y-4">
          <label className="offer-field">
            Datos de prueba
            <select value={tipo} disabled={midiendo} onChange={event => {
              setTipo(event.target.value)
              setResultados([])
              setError('')
            }}>
              {Object.entries(pruebas).map(([valor, prueba]) => <option key={valor} value={valor}>{prueba.etiqueta}</option>)}
            </select>
          </label>
          <button type="button" className="offer-button offer-button-primary" disabled={midiendo} onClick={medir}>
            {midiendo ? 'Midiendo…' : 'Medir desde este dispositivo'}
          </button>
          <ol className="list-decimal pl-6">
            {resultados.map((ms, indice) => <li key={indice}>10.000 {tipo} en {ms} ms</li>)}
          </ol>
          {resultados.length === 3 && <p role="status">Mediana: {[...resultados].sort((a, b) => a - b)[1]} ms.</p>}
          {error && <p role="alert">{error}</p>}
        </section>
      </div>
    </main>
  )
}
