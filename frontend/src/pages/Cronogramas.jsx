import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import useActualizarLista from '../hooks/useActualizarLista'
import { useAuth } from '../context/AuthContext'
import TablaAgenda from '../components/TablaAgenda'
import { buscarDisciplinas } from '../services/disciplinasService'
import { getEscenarios } from '../services/veeduriaService'
import {
  buscarEntrenadores,
  listarCronogramas,
  crearCronograma,
  actualizarCronograma,
  bajaCronograma,
  listarDisciplinasParaAgenda,
  solicitarVinculacion
} from '../services/entrenadoresService'

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']

const VACIO = {
  id_disciplina: '',
  id_escenario: '',
  id_entrenador: '',
  dia_semana: 'LUNES',
  hora_inicio: '',
  hora_fin: '',
  vigencia_desde: '',
  vigencia_hasta: ''
}

export default function Cronogramas() {
  const { usuario } = useAuth()
  const esAdmin = usuario.rol === 'ADMINISTRATIVO'

  const [filas, setFilas] = useState([])
  const [disciplinas, setDisciplinas] = useState([])
  const [escenarios, setEscenarios] = useState([])
  const [entrenadores, setEntrenadores] = useState([])
  const [disciplinaSolicitada, setDisciplinaSolicitada] = useState('')
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false)
  const [mensajeSolicitud, setMensajeSolicitud] = useState(null)
  const consultaDisciplinas = useRef(0)
  const consultarDisciplinas = esAdmin ? buscarDisciplinas : listarDisciplinasParaAgenda
  const disciplinasParaProgramar = esAdmin ? disciplinas : disciplinas.filter(d => d.vinculacion === 'VINCULADA')
  const opcionesSolicitud = disciplinas.filter(d => d.vinculacion === 'DISPONIBLE')
  const pendientes = disciplinas.filter(d => d.vinculacion === 'PENDIENTE')
  const [form, setForm] = useState(VACIO)
  const [editandoId, setEditandoId] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [cargandoFilas, setCargandoFilas] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [bajandoId, setBajandoId] = useState(null)

  const cargarFilas = async () => {
    try {
      const res = await listarCronogramas({})
      setFilas(res.data.data)
    } catch {
      setFilas([])
      setMensaje({ tipo: 'error', texto: 'No se pudieron cargar los cronogramas' })
    } finally {
      setCargandoFilas(false)
    }
  }

  useEffect(() => {
    let activo = true
    const cargarListas = async () => {
      try {
        const [d, e] = await Promise.all([consultarDisciplinas(), getEscenarios()])
        if (activo) {
          setDisciplinas(d.data.data)
          setEscenarios(e.data.data)
        }
        if (esAdmin) {
          const t = await buscarEntrenadores({})
          if (activo) setEntrenadores(t.data.data)
        }
      } catch {
        if (activo) setMensaje({ tipo: 'error', texto: 'No se pudieron cargar las listas del formulario' })
      }
    }

    listarCronogramas({})
      .then((res) => {
        if (activo) setFilas(res.data.data)
      })
      .catch(() => {
        if (activo) {
          setFilas([])
          setMensaje({ tipo: 'error', texto: 'No se pudieron cargar los cronogramas' })
        }
      })
      .finally(() => {
        if (activo) setCargandoFilas(false)
      })
    cargarListas()
    return () => {
      activo = false
    }
  }, [esAdmin, consultarDisciplinas])

  useActualizarLista(async () => {
    if (esAdmin || enviandoSolicitud) return
    const turno = ++consultaDisciplinas.current
    try {
      const { data } = await listarDisciplinasParaAgenda()
      if (turno === consultaDisciplinas.current) setDisciplinas(data.data)
    } catch {
      // Se conserva el último catálogo disponible.
    }
  })

  const enviarSolicitud = async event => {
    event.preventDefault()
    if (enviandoSolicitud || !opcionesSolicitud.some(d => String(d.id_disciplina) === disciplinaSolicitada)) return
    setEnviandoSolicitud(true)
    setMensajeSolicitud(null)
    try {
      await solicitarVinculacion(Number(disciplinaSolicitada))
      consultaDisciplinas.current += 1
      setDisciplinas(actuales => actuales.map(d =>
        String(d.id_disciplina) === disciplinaSolicitada ? { ...d, vinculacion: 'PENDIENTE' } : d
      ))
      setDisciplinaSolicitada('')
      setMensajeSolicitud({ tipo: 'ok', texto: 'Solicitud enviada al administrador. Queda pendiente de aprobación.' })
    } catch (error) {
      setMensajeSolicitud({ tipo: 'error', texto: error.response?.data?.message || 'No se pudo enviar la solicitud.' })
    } finally {
      setEnviandoSolicitud(false)
    }
  }

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  const guardar = async (e) => {
    e.preventDefault()
    setMensaje(null)
    setGuardando(true)
    try {
      const res = editandoId
        ? await actualizarCronograma(editandoId, form)
        : await crearCronograma(form)
      setMensaje({ tipo: 'ok', texto: res.data.message })
      setForm(VACIO)
      setEditandoId(null)
      setCargandoFilas(true)
      cargarFilas()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.message || 'No se pudo guardar el cronograma' })
    } finally {
      setGuardando(false)
    }
  }

  const editar = (f) => {
    setEditandoId(f.id_cronograma)
    setForm({
      id_disciplina: f.id_disciplina,
      id_escenario: f.id_escenario,
      id_entrenador: f.id_entrenador,
      dia_semana: f.dia_semana,
      hora_inicio: f.hora_inicio.slice(0, 5),
      hora_fin: f.hora_fin.slice(0, 5),
      vigencia_desde: f.vigencia_desde,
      vigencia_hasta: f.vigencia_hasta || ''
    })
    setMensaje(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelar = () => {
    setEditandoId(null)
    setForm(VACIO)
    setMensaje(null)
  }

  const baja = async (f) => {
    if (!window.confirm(`¿Dar de baja ${f.disciplina} (${f.dia_semana} ${f.hora_inicio.slice(0, 5)})?`)) return
    setMensaje(null)
    setBajandoId(f.id_cronograma)
    try {
      const res = await bajaCronograma(f.id_cronograma)
      setMensaje({ tipo: 'ok', texto: res.data.message })
      setCargandoFilas(true)
      cargarFilas()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.message || 'No se pudo dar de baja' })
    } finally {
      setBajandoId(null)
    }
  }

  return (
    <main className="offer-page">
      <div className="offer-container">
        <header className="offer-page-heading">
          <span className="offer-eyebrow">SIVEC / Programación</span>
          <h1>
          {esAdmin ? 'Administrar cronogramas' : 'Mi agenda de entrenamientos'}
          </h1>
          <p>Consulta y organiza los horarios publicados para disciplinas y escenarios.</p>
        </header>

        <form onSubmit={guardar} className="offer-filter-panel offer-schedule-form">
          <div className="offer-filter-heading">
            <div>
              <h2>{editandoId ? 'Editar horario' : 'Nuevo horario'}</h2>
              <p>Completa los datos del cronograma según la oferta registrada.</p>
            </div>
          </div>
          {!esAdmin && <a href="#solicitar-disciplina" className="offer-text-link inline-block mb-4">Solicitar otra disciplina</a>}

          <div className="offer-filter-grid offer-filter-grid-three">
            <label className="offer-field">
              <span>Disciplina</span>
              <select value={form.id_disciplina} onChange={cambiar('id_disciplina')} required>
                <option value="">Selecciona una disciplina</option>
                {disciplinasParaProgramar.map((d) => <option key={d.id_disciplina} value={d.id_disciplina}>{d.nombre}</option>)}
              </select>
            </label>

            <label className="offer-field">
              <span>Escenario</span>
              <select value={form.id_escenario} onChange={cambiar('id_escenario')} required>
                <option value="">Selecciona un escenario</option>
                {escenarios.map((s) => <option key={s.id_escenario} value={s.id_escenario}>{s.nombre}</option>)}
              </select>
            </label>

            {esAdmin && (
              <label className="offer-field">
                <span>Entrenador</span>
                <select value={form.id_entrenador} onChange={cambiar('id_entrenador')} required>
                  <option value="">Selecciona un entrenador</option>
                  {entrenadores.map((t) => <option key={t.id_persona} value={t.id_persona}>{t.nombre_completo}</option>)}
                </select>
              </label>
            )}

            <label className="offer-field">
              <span>Día de la semana</span>
              <select value={form.dia_semana} onChange={cambiar('dia_semana')}>
                {DIAS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>

            <label className="offer-field">
              <span>Hora de inicio</span>
              <input type="time" value={form.hora_inicio} onChange={cambiar('hora_inicio')} required />
            </label>

            <label className="offer-field">
              <span>Hora de fin</span>
              <input type="time" value={form.hora_fin} onChange={cambiar('hora_fin')} required />
            </label>

            <label className="offer-field">
              <span>Vigente desde</span>
              <input type="date" value={form.vigencia_desde} onChange={cambiar('vigencia_desde')} required />
            </label>

            <label className="offer-field">
              <span>Vigente hasta (opcional)</span>
              <input type="date" value={form.vigencia_hasta} onChange={cambiar('vigencia_hasta')} />
            </label>
          </div>

          {mensaje && (
            <p className={`offer-notice ${mensaje.tipo}`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>
              {mensaje.texto}
            </p>
          )}

          <div className="offer-filter-actions">
            <button className="offer-button offer-button-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Registrar horario'}
            </button>
            {editandoId && (
              <button type="button" onClick={cancelar} className="offer-button offer-button-secondary" disabled={guardando}>Cancelar</button>
            )}
          </div>
        </form>

        {!esAdmin && (
          <section id="solicitar-disciplina" className="offer-filter-panel mt-6 scroll-mt-24">
            <div className="offer-filter-heading">
              <div>
                <h2>Solicitar otra disciplina</h2>
                <p>Cuando el administrador apruebe la vinculación, podrás programar horarios para esa disciplina.</p>
              </div>
              <Link to="/entrenador/solicitudes" className="offer-text-link">Mis solicitudes</Link>
            </div>
            {opcionesSolicitud.length > 0 && (
              <form onSubmit={enviarSolicitud} className="space-y-3">
                <label className="offer-field">
                  Disciplina para solicitar
                  <select value={disciplinaSolicitada} disabled={enviandoSolicitud} required
                    onChange={event => setDisciplinaSolicitada(event.target.value)}>
                    <option value="">Selecciona una disciplina</option>
                    {opcionesSolicitud.map(d => <option key={d.id_disciplina} value={d.id_disciplina}>{d.nombre}</option>)}
                  </select>
                </label>
                <button className="offer-button offer-button-primary" disabled={!disciplinaSolicitada || enviandoSolicitud}>
                  {enviandoSolicitud ? 'Enviando…' : 'Enviar solicitud al administrador'}
                </button>
              </form>
            )}
            {pendientes.length > 0 && <p className="mt-3">Pendientes de aprobación: {pendientes.map(d => d.nombre).join(', ')}.</p>}
            {mensajeSolicitud && <p className={`offer-notice ${mensajeSolicitud.tipo}`} role={mensajeSolicitud.tipo === 'error' ? 'alert' : 'status'}>{mensajeSolicitud.texto}</p>}
            {!opcionesSolicitud.length && !pendientes.length && <p>No hay disciplinas disponibles para solicitar.</p>}
          </section>
        )}


        <div className="offer-results-heading">
          <div>
            <h2>Horarios registrados</h2>
            <p>{esAdmin ? 'Consulta y administra los cronogramas existentes.' : 'Consulta los horarios asociados a tu agenda.'}</p>
          </div>
        </div>
        {cargandoFilas && <div className="offer-state" role="status">Cargando cronogramas…</div>}
        <TablaAgenda
          filas={filas}
          vacio={cargandoFilas ? 'Cargando cronogramas…' : 'No hay cronogramas registrados.'}
          acciones={(f) => (
            <>
              <button type="button" onClick={() => editar(f)} className="offer-table-action">Editar</button>
              <button type="button" onClick={() => baja(f)} disabled={bajandoId !== null} className="offer-table-action danger">
                {bajandoId === f.id_cronograma ? 'Procesando…' : 'Dar de baja'}
              </button>
            </>
          )}
        />
      </div>
    </main>
  )
}