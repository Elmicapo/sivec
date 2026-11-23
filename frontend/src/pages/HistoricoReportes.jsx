import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { HistoricoVeedurias } from './PanelCMJ'

export default function HistoricoReportes() {
  const { usuario } = useAuth()
  const autorizado = ['CMJ', 'ADMINISTRATIVO'].includes(usuario.rol)

  return (
    <main className="offer-page">
      <div className="offer-container space-y-6">
        <header className="offer-page-heading">
          <h1>Histórico de reportes</h1>
        </header>
        {autorizado ? <HistoricoVeedurias /> : (
          <section className="offer-filter-panel space-y-4">
            <p>El histórico está disponible para el CMJ y usuarios administrativos.</p>
            <Link className="offer-button offer-button-primary" to="/seguimiento">Consultar mi reporte con un código</Link>
          </section>
        )}
      </div>
    </main>
  )
}
