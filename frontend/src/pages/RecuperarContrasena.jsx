import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../services/api'

export default function RecuperarContrasena({ restablecer = false }) {
  const { hash } = useLocation()
  const token = hash.slice(1)
  const enlaceValido = !restablecer || /^[a-f\d]{64}$/.test(token)
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const enviar = async event => {
    event.preventDefault()
    if (restablecer && password !== confirmacion) {
      setResultado({ error: 'Las contraseñas no coinciden.' })
      return
    }
    setEnviando(true)
    setResultado(null)
    try {
      const { data } = restablecer
        ? await api.post('/auth/restablecer-contrasena', { token, password })
        : await api.post('/auth/recuperar-contrasena', { correo: correo.trim() })
      setPassword('')
      setConfirmacion('')
      setResultado({ mensaje: data.message })
    } catch (error) {
      setResultado({ error: error.response?.data?.message || 'No pudimos procesar la solicitud. Verifica tu conexión.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="offer-page">
      <div className="offer-container offer-container-narrow">
        <header className="offer-page-heading">
          <h1>{restablecer ? 'Crea una contraseña nueva' : 'Recupera tu contraseña'}</h1>
        </header>
        <div className="offer-filter-panel">
          {!enlaceValido && <p className="sivec-alert sivec-alert-error" role="alert">Abre el enlace completo del correo o solicita uno nuevo.</p>}
          {resultado?.error && <p className="sivec-alert sivec-alert-error mb-4" role="alert">{resultado.error}</p>}
          {resultado?.mensaje && <p className="sivec-alert sivec-alert-success" role="status">{resultado.mensaje}</p>}
          {enlaceValido && !resultado?.mensaje && (
            <form onSubmit={enviar} className="space-y-4">
              {restablecer ? (
                <>
                  <label className="offer-field">Contraseña nueva
                    <input type="password" autoComplete="new-password" name="password" value={password}
                      onChange={event => setPassword(event.target.value)} minLength={8} maxLength={72} required disabled={enviando} />
                  </label>
                  <label className="offer-field">Confirma la contraseña
                    <input type="password" autoComplete="new-password" name="confirmacion" value={confirmacion}
                      onChange={event => setConfirmacion(event.target.value)} minLength={8} maxLength={72} required disabled={enviando} />
                  </label>
                </>
              ) : (
                <label className="offer-field">Correo electrónico de tu cuenta
                  <input type="email" autoComplete="email" name="correo" value={correo}
                    onChange={event => setCorreo(event.target.value)} maxLength={254} required disabled={enviando} />
                </label>
              )}
              <button className="offer-button offer-button-primary" type="submit" disabled={enviando}>
                {enviando ? 'Procesando…' : restablecer ? 'Guardar contraseña' : 'Enviar enlace'}
              </button>
            </form>
          )}
          <div className="offer-filter-actions">
            <Link to="/login" replace className="offer-button offer-button-secondary">Volver a iniciar sesión</Link>
            {restablecer && !resultado?.mensaje && <Link to="/recuperar-contrasena" replace className="offer-button offer-button-secondary">Solicitar otro enlace</Link>}
          </div>
        </div>
      </div>
    </main>
  )
}
