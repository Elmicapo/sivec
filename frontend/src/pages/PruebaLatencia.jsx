import { useState } from 'react'
import api from '../services/api'

const pruebas = {
  disciplinas: { ruta: '/disciplinas/prueba-latencia', etiqueta: 'Disciplinas' },
  usuarios: { ruta: '/pruebas/latencia/usuarios', etiqueta: 'Usuarios' }
}

export default function PruebaLatencia() {
  const [tipo, setTipo] = useState('ambas')
  const [midiendo, setMidiendo] = useState(false)
  const [resultados, setResultados] = useState({})
  const tipos = tipo === 'ambas' ? ['usuarios', 'disciplinas'] : [tipo]

  const medir = async () => {
    setMidiendo(true)
    setResultados({})
    try {
      for (const conjunto of tipos) {
        const tiempos = []
        try {
          for (let intento = 0; intento < 3; intento += 1) {
            const inicio = performance.now()
            const respuesta = await api.get(pruebas[conjunto].ruta, {
              transformResponse: [texto => texto],
              timeout: 15_000
            })
            const ms = Math.round(performance.now() - inicio)
            const { data } = JSON.parse(respuesta.data)
            if (!Array.isArray(data) || data.length !== 10_000) {
              throw new Error(`La respuesta debe contener 10.000 ${conjunto}.`)
            }
            tiempos.push(ms)
            setResultados(actuales => ({ ...actuales, [conjunto]: { tiempos: [...tiempos] } }))
          }
        } catch (fallo) {
          let error = fallo.message
          try {
            if (fallo.response?.data) error = JSON.parse(fallo.response.data).message || error
          } catch {
            error = 'El servidor no devolvió datos de la prueba.'
          }
          setResultados(actuales => ({ ...actuales, [conjunto]: { tiempos, error } }))
        }
      }
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
              setResultados({})
            }}>
              <option value="ambas">Usuarios y disciplinas</option>
              {Object.entries(pruebas).map(([valor, prueba]) => <option key={valor} value={valor}>{prueba.etiqueta}</option>)}
            </select>
          </label>
          <button type="button" className="offer-button offer-button-primary" disabled={midiendo} onClick={medir}>
            {midiendo ? 'Midiendo…' : 'Medir desde este dispositivo'}
          </button>
          {tipos.map(conjunto => {
            const resultado = resultados[conjunto]
            if (!resultado) return null
            const { tiempos, error } = resultado
            return (
              <section key={conjunto} className="space-y-2">
                <h2 className="font-semibold">{pruebas[conjunto].etiqueta}</h2>
                <ol className="list-decimal pl-6">
                  {tiempos.map((ms, indice) => <li key={indice}>10.000 {conjunto} en {ms} ms</li>)}
                </ol>
                {tiempos.length === 3 && <p role="status">Mediana de {conjunto}: {[...tiempos].sort((a, b) => a - b)[1]} ms.</p>}
                {error && <p role="alert">{error}</p>}
              </section>
            )
          })}
        </section>
      </div>
    </main>
  )
}
