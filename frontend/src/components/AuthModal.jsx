import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Login from '../pages/Login'
import Registro from '../pages/Registro'

export default function AuthModal({ mode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const dialogRef = useRef(null)
  const closeTimer = useRef(null)
  const cerrarActual = useRef(null)
  const [closing, setClosing] = useState(false)

  const cerrar = () => {
    if (closing) return
    setClosing(true)
    closeTimer.current = window.setTimeout(() => {
      navigate(location.state?.backgroundLocation || '/', { replace: true })
    }, 150)
  }

  useEffect(() => {
    cerrarActual.current = cerrar
  })

  useEffect(() => {
    const previousFocus = document.activeElement
    const dialog = dialogRef.current
    dialog?.querySelector('input')?.focus()
    if (!dialog?.querySelector('input')) dialog?.focus()
    document.body.classList.add('auth-modal-open')

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cerrarActual.current?.()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])'
      )].filter((element) => element.offsetParent !== null)
      if (!focusable.length) {
        event.preventDefault()
        dialog.focus()
      } else if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault()
        focusable.at(-1).focus()
      } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
        event.preventDefault()
        focusable[0].focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(closeTimer.current)
      document.body.classList.remove('auth-modal-open')
      document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus?.()
    }
  }, [location.pathname])

  return (
    <div
      className={`auth-modal-backdrop${closing ? ' auth-modal-closing' : ''}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cerrar()
      }}
    >
      <section
        aria-labelledby="auth-modal-title"
        aria-modal="true"
        className="auth-modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label="Cerrar ventana"
          className="auth-modal-close"
          onClick={cerrar}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
        {mode === 'registro' ? <Registro /> : <Login />}
      </section>
    </div>
  )
}
