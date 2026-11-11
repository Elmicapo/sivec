import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { getDisciplinasActivas } from '../services/deportesService'
import { useAuth } from '../context/AuthContext'

const VACIO = {
  nombre_completo: '',
  numero_identificacion: '',
  correo_electronico: '',
  login: '',
  telefono: '',
  genero: '',
  fecha_nacimiento: '',
  direccion_residencia: '',
  id_disciplina: '',
  password: '',
  confirmar: ''
}
const MAX_DATE = new Date().toISOString().slice(0, 10)

export default function Registro() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [tipoUsuario, setTipoUsuario] = useState('DEPORTISTA')
  const [form, setForm] = useState(VACIO)
  const [disciplinas, setDisciplinas] = useState([])
  const [errorDisciplinas, setErrorDisciplinas] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (tipoUsuario !== 'ENTRENADOR') return undefined
    let active = true
    getDisciplinasActivas()
      .then(({ data }) => {
        if (active) {
          setDisciplinas((data.data || []).filter((item) => item.categoria === 'DEPORTIVA'))
          setErrorDisciplinas('')
        }
      })
      .catch(() => {
        if (active) setErrorDisciplinas('No se pudieron cargar los deportes. Intenta de nuevo más tarde.')
      })
    return () => { active = false }
  }, [tipoUsuario])

  const cambiar = (event) => {
    setForm((actual) => ({ ...actual, [event.target.name]: event.target.value }))
  }

  const enviar = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (form.password !== form.confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (tipoUsuario === 'ENTRENADOR' && !form.id_disciplina) {
      setError('Selecciona el deporte que entrenas')
      return
    }

    setEnviando(true)
    try {
      const datos = { ...form }
      delete datos.confirmar
      await api.post('/auth/registro', {
        ...datos,
        tipo_usuario: tipoUsuario,
        id_disciplina: tipoUsuario === 'ENTRENADOR' ? Number(form.id_disciplina) : undefined
      })
      setSuccess(tipoUsuario === 'ENTRENADOR'
        ? 'Cuenta creada. Tu solicitud de vinculación fue enviada al equipo administrativo.'
        : 'Tu cuenta fue creada correctamente.')
      await new Promise((resolve) => window.setTimeout(resolve, 700))
      const usuario = await login(form.correo_electronico.trim(), form.password)
      const destinoSolicitado = location.state?.from?.pathname
      navigate(destinoSolicitado || (usuario.rol === 'ENTRENADOR' ? '/entrenador' : '/deportista'), {
        replace: true
      })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo completar el registro. Intenta nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  const passwordType = mostrarPassword ? 'text' : 'password'

  return (
    <div className="auth-form auth-form-register">
      <span className="auth-kicker">Únete a SIVEC</span>
      <h1 id="auth-modal-title">Crear cuenta</h1>
      <p className="auth-description">Regístrate para participar en la oferta deportiva y cultural.</p>

      <div aria-label="Tipo de cuenta" className="auth-role-toggle" role="group">
        <button
          aria-pressed={tipoUsuario === 'DEPORTISTA'}
          className={tipoUsuario === 'DEPORTISTA' ? 'auth-role-active' : ''}
          onClick={() => setTipoUsuario('DEPORTISTA')}
          type="button"
        >
          Deportista
        </button>
        <button
          aria-pressed={tipoUsuario === 'ENTRENADOR'}
          className={tipoUsuario === 'ENTRENADOR' ? 'auth-role-active' : ''}
          onClick={() => setTipoUsuario('ENTRENADOR')}
          type="button"
        >
          Entrenador
        </button>
      </div>
      <p className="auth-role-note">
        {tipoUsuario === 'ENTRENADOR'
          ? 'La vinculación con el deporte seleccionado requiere aprobación administrativa.'
          : 'Las cuentas administrativas y CMJ se habilitan mediante gestión interna.'}
      </p>

      <form className="auth-fields" onSubmit={enviar}>
        {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
        {success && <p className="auth-message auth-message-success" role="status">{success}</p>}
        <div className="auth-fields-grid">
          <label className="auth-field auth-field-wide">
            <span>Nombre completo</span>
            <input autoComplete="name" maxLength={150} name="nombre_completo"
              onChange={cambiar} required value={form.nombre_completo} />
          </label>
          <label className="auth-field">
            <span>Número de identificación</span>
            <input autoComplete="off" maxLength={20} name="numero_identificacion"
              onChange={cambiar} required value={form.numero_identificacion} />
          </label>
          <label className="auth-field">
            <span>Nombre de usuario</span>
            <input autoComplete="username" minLength={4} maxLength={50} name="login"
              onChange={cambiar} required value={form.login} />
          </label>
          <label className="auth-field auth-field-wide">
            <span>Correo electrónico</span>
            <input autoComplete="email" maxLength={120} name="correo_electronico"
              onChange={cambiar} required type="email" value={form.correo_electronico} />
          </label>
          <label className="auth-field">
            <span>Número de teléfono</span>
            <input autoComplete="tel" maxLength={20} name="telefono"
              onChange={cambiar} required type="tel" value={form.telefono} />
          </label>

          {tipoUsuario === 'DEPORTISTA' ? (
            <>
              <label className="auth-field">
                <span>Género</span>
                <select name="genero" onChange={cambiar} required value={form.genero}>
                  <option value="">Selecciona</option>
                  <option value="F">Femenino</option>
                  <option value="M">Masculino</option>
                  <option value="OTRO">Otro</option>
                </select>
              </label>
              <label className="auth-field">
                <span>Fecha de nacimiento</span>
                <input autoComplete="bday" max={MAX_DATE}
                  name="fecha_nacimiento" onChange={cambiar} required type="date"
                  value={form.fecha_nacimiento} />
              </label>
              <label className="auth-field auth-field-wide">
                <span>Dirección de residencia</span>
                <input autoComplete="street-address" maxLength={200} name="direccion_residencia"
                  onChange={cambiar} required value={form.direccion_residencia} />
              </label>
            </>
          ) : (
            <label className="auth-field auth-field-wide">
              <span>Deporte que entrenas</span>
              <select
                disabled={Boolean(errorDisciplinas) || disciplinas.length === 0}
                name="id_disciplina"
                onChange={cambiar}
                required
                value={form.id_disciplina}
              >
                <option value="">Selecciona un deporte</option>
                {disciplinas.map((disciplina) => (
                  <option key={disciplina.id_disciplina} value={disciplina.id_disciplina}>
                    {disciplina.nombre}
                  </option>
                ))}
              </select>
              {errorDisciplinas && <small className="auth-field-hint">{errorDisciplinas}</small>}
            </label>
          )}

          <label className="auth-field auth-field-wide">
            <span>Contraseña</span>
            <span className="auth-password-wrap">
              <input autoComplete="new-password" minLength={8} name="password"
                onChange={cambiar} required type={passwordType} value={form.password} />
              <button aria-label={mostrarPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                className="auth-password-toggle" onClick={() => setMostrarPassword((visible) => !visible)}
                type="button">
                {mostrarPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </span>
          </label>
          <label className="auth-field auth-field-wide">
            <span>Confirmar contraseña</span>
            <input autoComplete="new-password" minLength={8} name="confirmar"
              onChange={cambiar} required type={passwordType} value={form.confirmar} />
          </label>
        </div>
        <button className="auth-submit" disabled={enviando} type="submit">
          {enviando ? <><span className="auth-spinner" /> Creando cuenta...</> : 'Crear cuenta'}
        </button>
      </form>

      <p className="auth-switch">
        ¿Ya tienes cuenta?{' '}
        <Link state={location.state} to="/login">Inicia sesión</Link>
      </p>
    </div>
  )
}
