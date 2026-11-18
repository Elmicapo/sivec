import { useEffect, useMemo, useRef, useState } from 'react'
import { crearReporte, crearSolicitudEscenario, getEscenarios } from '../services/veeduriaService'
import { getDisciplinasActivas } from '../services/deportesService'

const MAX_FOTOS = 5
const MAX_PESO_FOTO = 5 * 1024 * 1024
const MAX_PESO_TOTAL = 20 * 1024 * 1024
const MAX_DIMENSION = 1920
const FORMATOS = new Set(['jpg', 'jpeg', 'png', 'webp'])
const TIPOS_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}
const TIPOS_ESCENARIO = [
  { valor: 'CANCHA', nombre: 'Cancha' },
  { valor: 'COLISEO', nombre: 'Coliseo' },
  { valor: 'ESTADIO', nombre: 'Estadio' },
  { valor: 'PARQUE', nombre: 'Parque' },
  { valor: 'PLACA_POLIDEPORTIVA', nombre: 'Placa polideportiva' },
  { valor: 'OTRO', nombre: 'Otro' }
]

const COMUNAS = {
  'Comuna 1: Bernardo Jaramillo': [
    'La Paz', 'Policarpa', 'Diana Cardona', 'Antonio Roldán', 'La Arboleda',
    'Santa María', 'La Alborada', 'El Concejo', 'Alfonso López', 'San Fernando',
    '4 de Junio'
  ],
  'Comuna 2: Ocho de Febrero': ['Obrero', 'Las Brisas', 'Primero de Mayo'],
  'Comuna 3: Pueblo Nuevo': [
    'Manzanares', 'Parroquial', 'Urb. La Navarra', 'Pueblo Nuevo',
    '9 de Octubre', 'La Esperanza', 'La Esmeralda', 'El Paraíso'
  ],
  'Comuna 4: José Joaquín Vélez': [
    'Centro', 'Fundadores', 'El Amparo', 'Nuevo Apartadó', 'Los Álamos',
    'El Ortiz', 'Los Almendros', 'Los Pinos', 'El Darién', 'Villa de Río',
    'Pueblo Quemado', 'Inv. La Libertad', 'Urb. Gualcalá', 'Santa María',
    'La Antigua', 'La Serranía', 'Laureles', 'Vélez', 'El Estadio',
    'Nueva Civilización', 'El Rosal', 'Chinita', 'Corrugados', 'Simón Bolívar',
    'El Salvador', 'Buenos Aires', 'Villa Mateguadua Germán'
  ]
}

const CORREGIMIENTOS = {
  'San José de Apartadó': [
    'La Buenos Victoria', 'Salsipuedes', 'La Balsa', 'El Tigre', 'Guineo Bajo',
    'El Osito', 'Los Mandarinos', 'El Gas', 'Guineo Alto', 'El Salto',
    'Arenas Altas', 'Arenas Bajas', 'El Porvenir', 'La Esperanza', 'Las Nieves',
    'Mulatos Cabecera', 'Mulatos Medio', 'La Resbalosa', 'La Hoz', 'Rodoxali',
    'Playa Larga', 'Sabaleta', 'Las Flores', 'La Unión', 'C.P. San José de Apartadó'
  ],
  'Puerto Girón': [
    'Zungo Abajo', 'San Pablo', 'Punto Rojo', 'El Diamante', 'El Guaro',
    'C.P. Bajo El Oso', 'C.P. Puerto Girón'
  ],
  Churidó: [
    'Churidó Puente', 'Churidó Medio', 'Churidó Sinaí', 'La Pancha',
    'C.P. Churidó Pueblo'
  ],
  'El Reposo': [
    'San Martín', 'Zungo Arriba', 'La Pedroza', 'La Danta', 'San Miguel',
    'C.P. Loma Verde', 'C.P. Los Naranjales', 'C.P. Vijagual',
    'Zungo Carretera', 'Casco Urbano El Reposo'
  ]
}

const ESTADOS = [
  { valor: 'VERDE', nombre: 'Buen estado', detalle: 'Se encuentra en buenas condiciones.', color: 'green' },
  { valor: 'AMARILLO', nombre: 'Necesita mantenimiento', detalle: 'Requiere atención o mantenimiento.', color: 'amber' },
  { valor: 'ROJO', nombre: 'Deteriorado', detalle: 'Presenta daños o deterioro importante.', color: 'red' }
]

const PASOS = [
  { titulo: 'Escenario', detalle: 'Lugar y ubicación' },
  { titulo: 'Estado', detalle: 'Condición observada' },
  { titulo: 'Evidencias', detalle: 'Fotos y contacto' },
  { titulo: 'Confirmar', detalle: 'Revisar el reporte' }
]
const PASOS_PROPUESTA = [
  { titulo: 'Escenario', detalle: 'Lugar y ubicación' },
  { titulo: 'Confirmar', detalle: 'Revisar la propuesta' }
]

function bytesEnMegabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function localidadEsCentroPoblado(nombre) {
  return nombre.startsWith('C.P.')
}

function cargarDimensiones(url) {
  return new Promise((resolve, reject) => {
    const imagen = new Image()
    imagen.onload = () => resolve({ ancho: imagen.naturalWidth, alto: imagen.naturalHeight })
    imagen.onerror = () => reject(new Error('El archivo no es una imagen válida o está dañado.'))
    imagen.src = url
  })
}

function Campo({ etiqueta, error, ayuda, id, children }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-100">{etiqueta}</label>
      {children}
      {ayuda && <p className="text-xs leading-relaxed text-slate-400">{ayuda}</p>}
      {error && <p className="text-sm font-medium text-rose-300" role="alert">{error}</p>}
    </div>
  )
}

const CLASE_CAMPO = 'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20'

const FORM_INICIAL = {
  tipo_escenario: 'existente',
  id_escenario: '',
  zona: '',
  comuna: '',
  barrio: '',
  corregimiento: '',
  localidad: '',
  nombre_escenario: '',
  tipo_fisico_escenario: '',
  id_disciplina: '',
  tipo_ubicacion: '',
  estado_propuesto: '',
  descripcion: '',
  nombre_completo: '',
  correo_electronico: ''
}

export default function Reportar() {
  const [paso, setPaso] = useState(0)
  const [escenarios, setEscenarios] = useState([])
  const [disciplinas, setDisciplinas] = useState([])
  const [cargandoEscenarios, setCargandoEscenarios] = useState(true)
  const [cargandoDisciplinas, setCargandoDisciplinas] = useState(true)
  const [errorEscenarios, setErrorEscenarios] = useState('')
  const [errorDisciplinas, setErrorDisciplinas] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(FORM_INICIAL)
  const [ubicacionGps, setUbicacionGps] = useState(null)
  const [solicitandoGps, setSolicitandoGps] = useState(false)
  const [errorGps, setErrorGps] = useState('')
  const [fotos, setFotos] = useState([])
  const fotosRef = useRef([])
  const inputFotosRef = useRef(null)
  const [fotoParaReemplazar, setFotoParaReemplazar] = useState(null)
  const [procesandoFotos, setProcesandoFotos] = useState(false)
  const [erroresFoto, setErroresFoto] = useState([])
  const [errores, setErrores] = useState({})
  const [confirmado, setConfirmado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const tituloConfirmacion = useRef(null)
  const [estadoCopia, setEstadoCopia] = useState('')
  const enviado = Boolean(resultado && !resultado.error)
  const esReporte = form.tipo_escenario === 'existente'
  const pasos = form.tipo_escenario === 'existente' ? PASOS : PASOS_PROPUESTA

  useEffect(() => {
    if (enviado) tituloConfirmacion.current?.focus()
  }, [enviado])

  useEffect(() => {
    let activo = true
    getEscenarios()
      .then((res) => {
        if (activo) setEscenarios(res.data.data || [])
      })
      .catch(() => {
        if (activo) setErrorEscenarios('No se pudieron cargar los escenarios. Intenta actualizar la página.')
      })
      .finally(() => {
        if (activo) setCargandoEscenarios(false)
      })

    getDisciplinasActivas()
      .then((res) => {
        if (activo) {
          const lista = res.data.data || []
          setDisciplinas(lista.filter((disciplina) => disciplina.categoria === 'DEPORTIVA'))
        }
      })
      .catch(() => {
        if (activo) setErrorDisciplinas('No se pudo cargar el catálogo de disciplinas deportivas.')
      })
      .finally(() => {
        if (activo) setCargandoDisciplinas(false)
      })

    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    fotosRef.current = fotos
  }, [fotos])

  useEffect(() => () => {
    fotosRef.current.forEach((foto) => URL.revokeObjectURL(foto.url))
  }, [])

  const escenariosFiltrados = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase('es')
    if (!consulta) return escenarios
    return escenarios.filter((escenario) => (escenario.nombre || '').toLocaleLowerCase('es').includes(consulta))
  }, [busqueda, escenarios])

  const disciplinaSeleccionada = disciplinas.find(
    (disciplina) => String(disciplina.id_disciplina) === form.id_disciplina
  )
  const escenarioSeleccionado = escenarios.find(
    (escenario) => String(escenario.id_escenario) === form.id_escenario
  )
  const pesoTotal = fotos.reduce((total, foto) => total + foto.file.size, 0)
  const localidadesRurales = form.corregimiento ? CORREGIMIENTOS[form.corregimiento] || [] : []

  const actualizar = (campo, valor) => {
    setForm((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actual) => ({ ...actual, [campo]: '' }))
  }

  const elegirTipoEscenario = (tipo) => {
    setPaso(0)
    setForm((actual) => ({
      ...actual,
      tipo_escenario: tipo,
      id_escenario: '',
      zona: '',
      comuna: '',
      barrio: '',
      corregimiento: '',
      localidad: '',
      nombre_escenario: '',
      tipo_fisico_escenario: '',
      id_disciplina: '',
      tipo_ubicacion: ''
    }))
    setUbicacionGps(null)
    setErrorGps('')
    setBusqueda('')
    setErrores({})
  }

  const erroresDePaso = (indice) => {
    const nuevosErrores = {}
    if (indice === 0) {
      if (form.tipo_escenario === 'existente') {
        if (!form.id_escenario) nuevosErrores.id_escenario = 'Busca y selecciona un escenario del inventario.'
      } else {
        if (!form.zona) nuevosErrores.zona = 'Selecciona la zona del escenario.'
        if (form.zona === 'urbana') {
          if (!form.comuna) nuevosErrores.comuna = 'Selecciona una comuna.'
          if (!form.barrio) nuevosErrores.barrio = 'Selecciona un barrio.'
        }
        if (form.zona === 'rural') {
          if (!form.corregimiento) nuevosErrores.corregimiento = 'Selecciona un corregimiento.'
          if (!form.localidad) nuevosErrores.localidad = 'Selecciona una vereda o centro poblado.'
        }
        if (!form.nombre_escenario.trim()) nuevosErrores.nombre_escenario = 'Escribe el nombre del escenario o cancha.'
        if (!form.tipo_fisico_escenario) nuevosErrores.tipo_fisico_escenario = 'Selecciona el tipo físico del escenario.'
        if (!form.id_disciplina) nuevosErrores.id_disciplina = 'Selecciona una disciplina deportiva.'
        if (!form.tipo_ubicacion) nuevosErrores.tipo_ubicacion = 'Selecciona GPS o ubicación manual.'
        if (form.tipo_ubicacion === 'gps' && !ubicacionGps) nuevosErrores.tipo_ubicacion = 'Solicita y autoriza la ubicación GPS para continuar.'
      }
    }
    if (indice === 1) {
      if (!form.estado_propuesto) nuevosErrores.estado_propuesto = 'Selecciona el estado observado.'
      if (!form.descripcion.trim()) nuevosErrores.descripcion = 'Describe los daños, fallas o necesidades.'
    }
    if (indice === 2) {
      if (fotos.length < 1) nuevosErrores.fotos = 'Agrega al menos una fotografía.'
      if (fotos.length > MAX_FOTOS) nuevosErrores.fotos = 'Puedes agregar hasta cinco fotografías.'
      if (!form.nombre_completo.trim()) nuevosErrores.nombre_completo = 'Ingresa tu nombre o apodo.'
      if (!form.correo_electronico.trim()) nuevosErrores.correo_electronico = 'Ingresa tu correo electrónico.'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo_electronico.trim())) {
        nuevosErrores.correo_electronico = 'Escribe un correo electrónico válido.'
      }
      if (pesoTotal > MAX_PESO_TOTAL) nuevosErrores.fotos = 'El peso total de las fotografías supera 20 MB.'
      if (procesandoFotos) nuevosErrores.fotos = 'Espera a que termine la validación de las fotografías.'
    }
    return nuevosErrores
  }

  const avanzar = () => {
    const nuevosErrores = erroresDePaso(paso)
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length === 0) {
      setPaso((actual) => Math.min(actual + 1, pasos.length - 1))
      setConfirmado(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const volver = () => {
    setPaso((actual) => Math.max(actual - 1, 0))
    setErrores({})
    setConfirmado(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const solicitarUbicacion = () => {
    if (!navigator.geolocation) {
      setErrorGps('Este navegador no permite solicitar la ubicación GPS.')
      return
    }
    setSolicitandoGps(true)
    setErrorGps('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUbicacionGps({ latitud: coords.latitude, longitud: coords.longitude })
        setForm((actual) => ({ ...actual, tipo_ubicacion: 'gps' }))
        setErrores((actual) => ({ ...actual, tipo_ubicacion: '' }))
        setSolicitandoGps(false)
      },
      (error) => {
        const mensajes = {
          1: 'No se concedió permiso de ubicación. Puedes autorizarlo o elegir ubicación manual.',
          2: 'No fue posible determinar la ubicación. Intenta de nuevo o elige ubicación manual.',
          3: 'La solicitud de ubicación tardó demasiado. Intenta de nuevo o elige ubicación manual.'
        }
        setErrorGps(mensajes[error.code] || 'No se pudo obtener la ubicación GPS.')
        setSolicitandoGps(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const seleccionarUbicacionManual = () => {
    setForm((actual) => ({ ...actual, tipo_ubicacion: 'manual' }))
    setUbicacionGps(null)
    setErrorGps('')
    setErrores((actual) => ({ ...actual, tipo_ubicacion: '' }))
  }

  const validarArchivo = async (file, listaActual, reemplazoId = null) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    if (!FORMATOS.has(extension)) {
      throw new Error('Formato no permitido. Usa JPG, JPEG, PNG o WebP.')
    }
    if (file.type && file.type !== TIPOS_MIME[extension]) {
      throw new Error('El formato declarado no coincide con la extensión del archivo.')
    }
    if (file.size > MAX_PESO_FOTO) {
      throw new Error('Cada fotografía debe pesar máximo 5 MB.')
    }
    if (!reemplazoId && listaActual.length >= MAX_FOTOS) {
      throw new Error('Puedes agregar hasta cinco fotografías.')
    }
    const pesoSinFoto = listaActual.reduce(
      (total, foto) => total + (foto.id === reemplazoId ? 0 : foto.file.size),
      0
    )
    if (pesoSinFoto + file.size > MAX_PESO_TOTAL) {
      throw new Error('El peso acumulado de las fotografías no puede superar 20 MB.')
    }

    const url = URL.createObjectURL(file)
    try {
      const dimensiones = await cargarDimensiones(url)
      if (dimensiones.ancho > MAX_DIMENSION || dimensiones.alto > MAX_DIMENSION) {
        throw new Error('La imagen debe medir como máximo 1920 × 1920 píxeles.')
      }
      return {
        id: reemplazoId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        url,
        ...dimensiones
      }
    } catch (error) {
      URL.revokeObjectURL(url)
      throw error
    }
  }

  const agregarFotos = async (files) => {
    const seleccionadas = Array.from(files)
    if (!seleccionadas.length) return
    setProcesandoFotos(true)
    setErroresFoto([])
    let siguienteLista = [...fotos]
    const fallas = []
    for (const file of seleccionadas) {
      try {
        const foto = await validarArchivo(file, siguienteLista)
        siguienteLista = [...siguienteLista, foto]
      } catch (error) {
        fallas.push(`${file.name}: ${error.message}`)
      }
    }
    setFotos(siguienteLista)
    setErroresFoto(fallas)
    setProcesandoFotos(false)
  }

  const reemplazarFoto = async (file, id) => {
    if (!file) return
    setProcesandoFotos(true)
    setErroresFoto([])
    try {
      const actualizada = await validarArchivo(file, fotos, id)
      const anterior = fotos.find((foto) => foto.id === id)
      setFotos((actuales) => actuales.map((foto) => foto.id === id ? actualizada : foto))
      if (anterior) URL.revokeObjectURL(anterior.url)
    } catch (error) {
      setErroresFoto([`${file.name}: ${error.message}`])
    } finally {
      setProcesandoFotos(false)
    }
  }

  const quitarFoto = (id) => {
    const eliminada = fotos.find((foto) => foto.id === id)
    setFotos((actuales) => actuales.filter((foto) => foto.id !== id))
    if (eliminada) URL.revokeObjectURL(eliminada.url)
    setErrores((actuales) => ({ ...actuales, fotos: '' }))
  }

  const abrirReemplazo = (id) => {
    setFotoParaReemplazar(id)
    inputFotosRef.current?.click()
  }

  const cambiarArchivo = (event) => {
    const seleccion = event.target.files
    if (seleccion?.length) {
      if (fotoParaReemplazar) reemplazarFoto(seleccion[0], fotoParaReemplazar)
      else agregarFotos(seleccion)
    }
    event.target.value = ''
    setFotoParaReemplazar(null)
  }

  const seleccionarComuna = (valor) => {
    setForm((actual) => ({ ...actual, comuna: valor, barrio: '' }))
    setErrores((actual) => ({ ...actual, comuna: '', barrio: '' }))
  }

  const seleccionarCorregimiento = (valor) => {
    setForm((actual) => ({ ...actual, corregimiento: valor, localidad: '' }))
    setErrores((actual) => ({ ...actual, corregimiento: '', localidad: '' }))
  }

  const clasePaso = (activo, completado) => (
    `flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition ${
      activo
        ? 'border-cyan-300 bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,.35)]'
        : completado
          ? 'border-blue-400 bg-blue-500/20 text-blue-200'
          : 'border-slate-700 bg-slate-900 text-slate-500'
    }`
  )

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(resultado.codigo_seguimiento)
      setEstadoCopia('Código copiado.')
    } catch {
      setEstadoCopia('Selecciona el código para copiarlo manualmente.')
    }
  }

  const iniciarNuevoReporte = () => {
    fotos.forEach(foto => URL.revokeObjectURL(foto.url))
    setFotos([])
    setErroresFoto([])
    setFotoParaReemplazar(null)
    setForm(FORM_INICIAL)
    setBusqueda('')
    setUbicacionGps(null)
    setErrorGps('')
    setResultado(null)
    setEstadoCopia('')
    setConfirmado(false)
    setErrores({})
    setPaso(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const enviarReporte = async () => {
    if (enviando || enviado) return
    if (!confirmado) {
      setErrores({ confirmacion: 'Confirma que revisaste la información.' })
      return
    }

    for (let indice = 0; indice < pasos.length - 1; indice += 1) {
      const nuevosErrores = erroresDePaso(indice)
      if (Object.keys(nuevosErrores).length) {
        setErrores(nuevosErrores)
        setConfirmado(false)
        setPaso(indice)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }
    setErrores({})

    setEnviando(true)
    setResultado(null)
    try {
      let response
      if (form.tipo_escenario === 'existente') {
        const evidencias = await Promise.all(fotos.map((foto) => new Promise((resolve, reject) => {
          const lector = new FileReader()
          lector.onload = () => resolve({ contenido: String(lector.result).split(',')[1] })
          lector.onerror = () => reject(new Error('No se pudo leer una fotografía.'))
          lector.readAsDataURL(foto.file)
        })))
        response = await crearReporte({
          id_escenario: Number(form.id_escenario),
          estado_propuesto: form.estado_propuesto,
          descripcion: form.descripcion.trim(),
          nombre_completo: form.nombre_completo.trim(),
          correo_electronico: form.correo_electronico.trim(),
          evidencias
        })
      } else {
        response = await crearSolicitudEscenario({
          id_disciplina: Number(form.id_disciplina),
          nombre_escenario: form.nombre_escenario.trim(),
          tipo_escenario: form.tipo_fisico_escenario,
          zona: form.zona.toUpperCase(),
          comuna: form.comuna || null,
          barrio: form.barrio || null,
          corregimiento: form.corregimiento || null,
          localidad_rural: form.localidad || null,
          tipo_localidad: form.zona === 'urbana' ? 'BARRIO' : form.localidad.startsWith('C.P.') ? 'CENTRO_POBLADO' : 'VEREDA',
          tipo_ubicacion: form.tipo_ubicacion.toUpperCase(),
          latitud: ubicacionGps?.latitud ?? null,
          longitud: ubicacionGps?.longitud ?? null
        })
      }
      if (response.data?.success !== true) {
        throw new Error('El servidor no confirmó el envío.')
      }
      setResultado(response.data)
    } catch (error) {
      setResultado({ error: error.response?.data?.message || error.message || 'No se pudo enviar la información.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="report-page min-h-screen bg-[#06101f] px-4 pb-16 pt-8 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 top-16 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -right-36 top-96 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-5xl">
        <header className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-cyan-200">
            <span className="h-2 w-2 rounded-full bg-cyan-300" />
            Veeduría ciudadana
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Reporta el estado de un escenario</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Comparte una observación para que el CMJ la revise. Recibir un reporte o validarlo no cambia el semáforo oficial; su actualización requiere una acción independiente.
          </p>
        </header>

        {enviado ? (
          <section aria-labelledby="envio-confirmado" className="rounded-3xl border border-emerald-300/30 bg-slate-900/90 p-6 shadow-2xl shadow-black/20 sm:p-8">
            <span aria-hidden="true" className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/15 text-2xl font-bold text-emerald-300">✓</span>
            <h2 id="envio-confirmado" ref={tituloConfirmacion} tabIndex={-1} className="text-2xl font-bold text-white sm:text-3xl">
              {esReporte ? 'Reporte enviado correctamente' : 'Propuesta enviada correctamente'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300" role="status">
              {esReporte ? 'Tu reporte quedó registrado y está pendiente de revisión por el CMJ.' : 'Tu propuesta quedó registrada para revisión del CMJ.'}
            </p>
            {esReporte && resultado.codigo_seguimiento && (
              <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                <p className="text-sm font-semibold text-slate-200">Código de seguimiento</p>
                <code className="mt-2 block select-all break-all text-sm text-white">{resultado.codigo_seguimiento}</code>
                <p className="mt-2 text-sm text-slate-300">Guárdalo para consultar el estado de tu reporte.</p>
                <button type="button" onClick={copiarCodigo} className="offer-button offer-button-secondary mt-3">
                  Copiar código
                </button>
                <p role="status" className="text-sm text-slate-300">{estadoCopia}</p>
              </div>
            )}
            <button type="button" onClick={iniciarNuevoReporte} className="offer-button offer-button-primary mt-6">
              Iniciar otro reporte
            </button>
          </section>
        ) : (
          <>
        <nav aria-label={form.tipo_escenario === 'existente' ? 'Progreso del reporte' : 'Progreso de la propuesta'} className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/10 sm:p-5">
          <ol className="grid grid-cols-4 gap-2 sm:gap-4">
            {pasos.map((item, index) => (
              <li key={item.titulo} className="min-w-0">
                <button
                  type="button"
                  onClick={() => index < paso && setPaso(index)}
                  disabled={index >= paso || enviando || enviado}
                  aria-current={index === paso ? 'step' : undefined}
                  className={`flex w-full items-center gap-2 text-left ${index < paso ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={clasePaso(index === paso, index < paso)}>{index < paso ? '✓' : index + 1}</span>
                  <span className="min-w-0">
                    <span className={`block truncate text-xs font-bold sm:text-sm ${index === paso ? 'text-white' : index < paso ? 'text-blue-200' : 'text-slate-500'}`}>
                      {item.titulo}
                    </span>
                    <span className="hidden truncate text-xs text-slate-500 sm:block">{item.detalle}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label="Progreso" aria-valuemin="1" aria-valuemax={pasos.length} aria-valuenow={paso + 1}>
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300 transition-all duration-300" style={{ width: `${((paso + 1) / pasos.length) * 100}%` }} />
          </div>
        </nav>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl shadow-black/20 sm:p-8">
          {paso === 0 && (
            <div className="space-y-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Etapa 1 de 4</p>
                <h2 className="mt-2 text-2xl font-bold text-white">¿Qué escenario quieres reportar?</h2>
                <p className="mt-2 text-sm text-slate-400">Selecciona un escenario del inventario oficial o envía una propuesta nueva para revisión del CMJ.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Tipo de escenario">
                {[
                  { valor: 'existente', titulo: 'Escenario existente', texto: 'Buscar en el inventario oficial' },
                  { valor: 'nuevo', titulo: 'Proponer escenario nuevo', texto: 'Requiere revisión independiente del CMJ' }
                ].map((opcion) => {
                  const activo = form.tipo_escenario === opcion.valor
                  return (
                    <button
                      key={opcion.valor}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => elegirTipoEscenario(opcion.valor)}
                      className={`rounded-2xl border p-4 text-left transition ${activo ? 'border-cyan-300/70 bg-cyan-300/10 ring-1 ring-cyan-300/30' : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'}`}
                    >
                      <span className="block font-bold text-white">{opcion.titulo}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">{opcion.texto}</span>
                    </button>
                  )
                })}
              </div>

              {form.tipo_escenario === 'existente' ? (
                <div className="space-y-4">
                  <Campo id="buscar-escenario" etiqueta="Buscar escenario" error={errores.id_escenario}>
                    <input
                      id="buscar-escenario"
                      className={CLASE_CAMPO}
                      value={busqueda}
                      onChange={(event) => setBusqueda(event.target.value)}
                      placeholder="Escribe el nombre del escenario"
                      autoComplete="off"
                    />
                  </Campo>
                  {escenarioSeleccionado && (
                    <p className="sivec-alert sivec-alert-info wrap-break-word" role="status">
                      Seleccionado: <strong>{escenarioSeleccionado.nombre}</strong>
                    </p>
                  )}
                  {cargandoEscenarios && <p className="text-sm text-slate-400" role="status">Cargando escenarios…</p>}
                  {errorEscenarios && <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200" role="alert">{errorEscenarios}</p>}
                  {!cargandoEscenarios && !errorEscenarios && (
                    <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="listbox" aria-label="Escenarios disponibles">
                      {escenariosFiltrados.map((escenario) => {
                        const seleccionado = String(escenario.id_escenario) === form.id_escenario
                        return (
                          <button
                            key={escenario.id_escenario}
                            type="button"
                            role="option"
                            aria-selected={seleccionado}
                            onClick={() => {
                              actualizar('id_escenario', String(escenario.id_escenario))
                              setErrores((actual) => ({ ...actual, id_escenario: '' }))
                            }}
                            className={`rounded-xl border p-3 text-left transition ${seleccionado ? 'border-cyan-300 bg-cyan-300/10' : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'}`}
                          >
                            <span className="block font-semibold text-white">{escenario.nombre}</span>
                            <span className="mt-1 block text-xs text-slate-400">Estado actual: {escenario.estado_semaforo || 'Sin dato'}</span>
                          </button>
                        )
                      })}
                      {escenariosFiltrados.length === 0 && (
                        <p className="col-span-full rounded-xl border border-slate-800 p-4 text-sm text-slate-400">
                          No encontramos coincidencias. Puedes proponer un escenario nuevo.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                    <p className="font-semibold text-amber-100">Propuesta pendiente de revisión</p>
                    <p className="mt-1 text-sm leading-5 text-amber-100/70">
                      Este escenario no se añadirá automáticamente al inventario ni al mapa oficial. El CMJ revisará la propuesta por separado; tampoco modificará el semáforo.
                    </p>
                  </div>

                  <Campo id="zona" etiqueta="Zona" error={errores.zona}>
                    <select id="zona" className={CLASE_CAMPO} value={form.zona} onChange={(event) => {
                      const zona = event.target.value
                      setForm((actual) => ({ ...actual, zona, comuna: '', barrio: '', corregimiento: '', localidad: '' }))
                      setErrores((actual) => ({ ...actual, zona: '', comuna: '', barrio: '', corregimiento: '', localidad: '' }))
                    }}>
                      <option value="">Selecciona zona urbana o rural</option>
                      <option value="urbana">Zona urbana</option>
                      <option value="rural">Zona rural</option>
                    </select>
                  </Campo>

                  {form.zona === 'urbana' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Campo id="comuna" etiqueta="Comuna" error={errores.comuna}>
                        <select id="comuna" className={CLASE_CAMPO} value={form.comuna} onChange={(event) => seleccionarComuna(event.target.value)}>
                          <option value="">Selecciona una comuna</option>
                          {Object.keys(COMUNAS).map((comuna) => <option key={comuna} value={comuna}>{comuna}</option>)}
                        </select>
                      </Campo>
                      <Campo id="barrio" etiqueta="Barrio" error={errores.barrio}>
                        <select id="barrio" className={CLASE_CAMPO} value={form.barrio} onChange={(event) => actualizar('barrio', event.target.value)} disabled={!form.comuna}>
                          <option value="">Selecciona un barrio</option>
                          {(COMUNAS[form.comuna] || []).map((barrio) => <option key={barrio} value={barrio}>{barrio}</option>)}
                        </select>
                      </Campo>
                    </div>
                  )}

                  {form.zona === 'rural' && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Campo id="corregimiento" etiqueta="Corregimiento" error={errores.corregimiento}>
                          <select id="corregimiento" className={CLASE_CAMPO} value={form.corregimiento} onChange={(event) => seleccionarCorregimiento(event.target.value)}>
                            <option value="">Selecciona un corregimiento</option>
                            {Object.keys(CORREGIMIENTOS).map((corregimiento) => <option key={corregimiento} value={corregimiento}>{corregimiento}</option>)}
                          </select>
                        </Campo>
                        <Campo
                          id="localidad-rural"
                          etiqueta="Vereda o centro poblado"
                          error={errores.localidad}
                          ayuda="Las entradas marcadas C.P. se conservan como centros poblados. Las demás clasificaciones rurales requieren verificación institucional."
                        >
                          <select id="localidad-rural" className={CLASE_CAMPO} value={form.localidad} onChange={(event) => actualizar('localidad', event.target.value)} disabled={!form.corregimiento}>
                            <option value="">Selecciona una localidad</option>
                            {localidadesRurales.map((localidad) => (
                              <option key={localidad} value={localidad}>
                                {localidadEsCentroPoblado(localidad) ? `${localidad} · Centro poblado` : localidad}
                              </option>
                            ))}
                          </select>
                        </Campo>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-500">
                        Catálogo transcrito de la relación suministrada para SIVEC; no constituye una certificación oficial.
                      </p>
                    </>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo id="nombre-escenario" etiqueta="Nombre de la cancha o escenario" error={errores.nombre_escenario}>
                      <input id="nombre-escenario" className={CLASE_CAMPO} value={form.nombre_escenario} onChange={(event) => actualizar('nombre_escenario', event.target.value)} placeholder="Ej. Cancha del barrio…" />
                    </Campo>
                    <Campo id="tipo-fisico-escenario" etiqueta="Tipo físico del escenario" error={errores.tipo_fisico_escenario}>
                      <select id="tipo-fisico-escenario" className={CLASE_CAMPO} value={form.tipo_fisico_escenario} onChange={(event) => actualizar('tipo_fisico_escenario', event.target.value)}>
                        <option value="">Selecciona un tipo</option>
                        {TIPOS_ESCENARIO.map((tipo) => <option key={tipo.valor} value={tipo.valor}>{tipo.nombre}</option>)}
                      </select>
                    </Campo>
                    <Campo id="disciplina" etiqueta="Disciplina deportiva" error={errores.id_disciplina} ayuda="Opciones del catálogo de disciplinas activas de SIVEC.">
                      <select id="disciplina" className={CLASE_CAMPO} value={form.id_disciplina} onChange={(event) => actualizar('id_disciplina', event.target.value)} disabled={cargandoDisciplinas || Boolean(errorDisciplinas) || disciplinas.length === 0}>
                        <option value="">{cargandoDisciplinas ? 'Cargando disciplinas…' : 'Selecciona una disciplina'}</option>
                        {disciplinas.map((disciplina) => (
                          <option key={disciplina.id_disciplina} value={disciplina.id_disciplina}>{disciplina.nombre}</option>
                        ))}
                      </select>
                      {errorDisciplinas && <p className="text-sm text-rose-300" role="alert">{errorDisciplinas}</p>}
                      {!cargandoDisciplinas && !errorDisciplinas && disciplinas.length === 0 && (
                        <p className="text-sm text-amber-200" role="status">No hay disciplinas deportivas disponibles; no se reemplaza el catálogo con texto libre.</p>
                      )}
                    </Campo>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-100">Ubicación del escenario</p>
                    <p className="text-xs text-slate-400">El GPS solo se solicita cuando lo pides. La ubicación manual usa la información territorial seleccionada; no se pueden escribir coordenadas.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button type="button" onClick={solicitarUbicacion} disabled={solicitandoGps} className={`rounded-xl border p-4 text-left transition ${form.tipo_ubicacion === 'gps' ? 'border-cyan-300 bg-cyan-300/10' : 'border-slate-700 bg-slate-950/50 hover:border-slate-500'}`}>
                        <span className="block font-semibold text-white">{solicitandoGps ? 'Solicitando permiso…' : 'Usar GPS'}</span>
                        <span className="mt-1 block text-xs text-slate-400">Solo tras tu acción y autorización del navegador.</span>
                      </button>
                      <button type="button" onClick={seleccionarUbicacionManual} className={`rounded-xl border p-4 text-left transition ${form.tipo_ubicacion === 'manual' ? 'border-cyan-300 bg-cyan-300/10' : 'border-slate-700 bg-slate-950/50 hover:border-slate-500'}`}>
                        <span className="block font-semibold text-white">Ubicación manual</span>
                        <span className="mt-1 block text-xs text-slate-400">Usa la zona y la selección territorial anterior.</span>
                      </button>
                    </div>
                    {form.tipo_ubicacion === 'gps' && ubicacionGps && <p className="text-sm text-emerald-300" role="status">Ubicación GPS capturada con permiso. Las coordenadas se enviarán con la propuesta.</p>}
                    {errorGps && <p className="text-sm text-rose-300" role="alert">{errorGps}</p>}
                    {errores.tipo_ubicacion && <p className="text-sm text-rose-300" role="alert">{errores.tipo_ubicacion}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {paso === 1 && form.tipo_escenario === 'existente' && (
            <div className="space-y-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Etapa 2 de 4</p>
                <h2 className="mt-2 text-2xl font-bold text-white">¿En qué estado está?</h2>
                <p className="mt-2 text-sm text-slate-400">Selecciona el estado que mejor representa tu observación actual.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Estado observado">
                {ESTADOS.map((estado) => {
                  const activo = form.estado_propuesto === estado.valor
                  const colores = {
                    green: activo ? 'border-emerald-300 bg-emerald-400/10 ring-1 ring-emerald-300/30' : 'border-slate-700 hover:border-emerald-400/50',
                    amber: activo ? 'border-amber-300 bg-amber-400/10 ring-1 ring-amber-300/30' : 'border-slate-700 hover:border-amber-400/50',
                    red: activo ? 'border-rose-300 bg-rose-400/10 ring-1 ring-rose-300/30' : 'border-slate-700 hover:border-rose-400/50'
                  }
                  const puntos = { green: 'bg-emerald-400', amber: 'bg-amber-300', red: 'bg-rose-400' }
                  return (
                    <button key={estado.valor} type="button" role="radio" aria-checked={activo} onClick={() => actualizar('estado_propuesto', estado.valor)} className={`rounded-2xl border bg-slate-950/50 p-4 text-left transition ${colores[estado.color]}`}>
                      <span className="flex items-center gap-2 font-bold text-white">
                        <span className={`h-3 w-3 rounded-full ${puntos[estado.color]}`} />
                        {estado.valor}: {estado.nombre}
                      </span>
                      <span className="mt-2 block text-sm leading-5 text-slate-400">{estado.detalle}</span>
                    </button>
                  )
                })}
              </div>
              {errores.estado_propuesto && <p className="text-sm text-rose-300" role="alert">{errores.estado_propuesto}</p>}
              <Campo id="descripcion" etiqueta="Describe lo que observaste" error={errores.descripcion} ayuda="Incluye los daños, fallas o necesidades que ayuden a entender la situación.">
                <textarea id="descripcion" className={`${CLASE_CAMPO} min-h-36 resize-y`} value={form.descripcion} onChange={(event) => actualizar('descripcion', event.target.value)} placeholder="Cuéntanos qué observaste en el escenario…" />
              </Campo>
            </div>
          )}

          {paso === 2 && form.tipo_escenario === 'existente' && (
            <div className="space-y-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Etapa 3 de 4</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Añade evidencias y tus datos de contacto</h2>
                <p className="mt-2 text-sm text-slate-400">Se requieren entre una y cinco fotografías, además de nombre o apodo y correo electrónico.</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                  <div>
                    <h3 className="font-bold text-white">Fotografías <span className="text-rose-300">*</span></h3>
                    <p className="mt-1 text-xs leading-5 text-slate-400">JPG, JPEG, PNG o WebP · máximo 5 MB cada una · 1920 × 1920 px.</p>
                  </div>
                  <p className={`text-xs font-semibold ${pesoTotal > MAX_PESO_TOTAL ? 'text-rose-300' : 'text-slate-300'}`}>
                    {fotos.length}/{MAX_FOTOS} · {bytesEnMegabytes(pesoTotal)} de 20 MB
                  </p>
                </div>
                <input ref={inputFotosRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple={!fotoParaReemplazar} onChange={cambiarArchivo} className="sr-only" aria-label={fotoParaReemplazar ? 'Reemplazar fotografía' : 'Seleccionar fotografías'} />
                <button type="button" onClick={() => { setFotoParaReemplazar(null); inputFotosRef.current?.click() }} disabled={procesandoFotos || fotos.length >= MAX_FOTOS} className="mt-4 rounded-xl border border-dashed border-slate-600 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-300/5 disabled:opacity-50">
                  {procesandoFotos ? 'Validando fotografías…' : '＋ Agregar fotografías'}
                </button>
                {errores.fotos && <p className="mt-3 text-sm text-rose-300" role="alert">{errores.fotos}</p>}
                {erroresFoto.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-rose-300" aria-label="Errores en fotografías">
                    {erroresFoto.map((error) => <li key={error}>{error}</li>)}
                  </ul>
                )}
                {fotos.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {fotos.map((foto, index) => (
                      <article key={foto.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
                        <img src={foto.url} alt={`Vista previa de fotografía ${index + 1}`} className="h-32 w-full object-cover" />
                        <div className="space-y-1 p-3">
                          <p className="truncate text-xs font-semibold text-white" title={foto.file.name}>{foto.file.name}</p>
                          <p className="text-xs text-slate-400">{bytesEnMegabytes(foto.file.size)} · {foto.ancho} × {foto.alto} px</p>
                          <div className="flex gap-3 pt-1">
                            <button type="button" onClick={() => abrirReemplazo(foto.id)} disabled={procesandoFotos} className="text-xs font-semibold text-cyan-200 hover:text-cyan-100 disabled:opacity-50">Reemplazar</button>
                            <button type="button" onClick={() => quitarFoto(foto.id)} disabled={procesandoFotos} className="text-xs font-semibold text-rose-300 hover:text-rose-200 disabled:opacity-50">Eliminar</button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  La validación de contenido real, eliminación de metadatos y almacenamiento privado deben completarse en el servidor. Las imágenes de esta vista previa permanecen solo en esta página y aún no se cargan.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Campo id="nombre-contacto" etiqueta="Nombre o apodo" error={errores.nombre_completo}>
                  <input id="nombre-contacto" className={CLASE_CAMPO} value={form.nombre_completo} onChange={(event) => actualizar('nombre_completo', event.target.value)} placeholder="¿Cómo te llamamos?" autoComplete="name" />
                </Campo>
                <Campo id="correo-contacto" etiqueta="Correo electrónico" error={errores.correo_electronico} ayuda="Se usará para el seguimiento y las notificaciones que se habiliten.">
                  <input id="correo-contacto" className={CLASE_CAMPO} type="email" value={form.correo_electronico} onChange={(event) => actualizar('correo_electronico', event.target.value)} placeholder="nombre@correo.com" autoComplete="email" />
                </Campo>
              </div>
              <p className="text-xs leading-5 text-slate-500">No solicitamos número de identificación. El acceso a los datos de contacto deberá restringirse a los roles autorizados.</p>
            </div>
          )}

          {paso === (form.tipo_escenario === 'existente' ? 3 : 1) && (
            <div className="space-y-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">
                  {form.tipo_escenario === 'existente' ? 'Etapa 4 de 4' : 'Etapa 2 de 2'}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  {form.tipo_escenario === 'existente' ? 'Revisa tu reporte' : 'Revisa tu propuesta'}
                </h2>
                <p className="mt-2 text-sm text-slate-400">Antes de enviar, puedes volver a una etapa anterior para corregir los datos.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-200">Escenario</h3>
                  {form.tipo_escenario === 'existente' ? (
                    <p className="mt-2 font-semibold text-white">{escenarioSeleccionado?.nombre || 'Sin seleccionar'}</p>
                  ) : (
                    <>
                      <p className="mt-2 font-semibold text-white">{form.nombre_escenario || 'Sin nombre'}</p>
                      <p className="mt-1 text-sm text-slate-300">{form.zona === 'urbana' ? `${form.comuna} · ${form.barrio}` : `${form.corregimiento} · ${form.localidad}`}</p>
                      <p className="mt-1 text-sm text-slate-400">{disciplinaSeleccionada?.nombre || 'Sin disciplina'}</p>
                      <p className="mt-2 text-xs text-amber-200">Propuesta nueva: pendiente de revisión independiente del CMJ.</p>
                      <p className="mt-1 text-xs text-slate-500">Ubicación: {form.tipo_ubicacion === 'gps' ? 'GPS autorizado' : form.tipo_ubicacion === 'manual' ? 'Selección territorial manual' : 'Sin seleccionar'}</p>
                    </>
                  )}
                </article>
                {form.tipo_escenario === 'existente' && <article className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-200">Estado reportado</h3>
                  <p className="mt-2 font-semibold text-white">{ESTADOS.find((estado) => estado.valor === form.estado_propuesto)?.nombre || 'Sin seleccionar'}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{form.descripcion || 'Sin descripción'}</p>
                </article>}
                {form.tipo_escenario === 'existente' && <article className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-200">Evidencias</h3>
                  <p className="mt-2 text-sm text-white">{fotos.length} fotografía(s) · {bytesEnMegabytes(pesoTotal)}</p>
                  <ul className="mt-2 space-y-1">
                    {fotos.map((foto) => <li key={foto.id} className="truncate text-xs text-slate-400">{foto.file.name}</li>)}
                  </ul>
                </article>}
                {form.tipo_escenario === 'existente' && <article className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-200">Contacto</h3>
                  <p className="mt-2 font-semibold text-white">{form.nombre_completo || 'Sin nombre'}</p>
                  <p className="mt-1 break-all text-sm text-slate-300">{form.correo_electronico || 'Sin correo'}</p>
                </article>}
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
                <input type="checkbox" checked={confirmado} disabled={enviando || enviado} onChange={(event) => {
                  setConfirmado(event.target.checked)
                  setErrores({})
                }} className="mt-1 h-4 w-4 accent-cyan-300" />
                <span>Confirmo que revisé la información presentada y que corresponde a mi observación.</span>
              </label>

              {errores.confirmacion && <p className="text-sm font-medium text-rose-300" role="alert">{errores.confirmacion}</p>}
              {resultado?.error && (
                <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-4" role="alert">
                  <p className="font-bold">{esReporte ? 'No se pudo enviar el reporte' : 'No se pudo enviar la propuesta'}</p>
                  <p className="mt-1 text-sm">{resultado.error}</p>
                </div>
              )}
              <button type="button" onClick={enviarReporte} disabled={enviando} className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3.5 font-bold text-slate-950 disabled:opacity-50">
                {enviando ? 'Enviando…' : esReporte ? 'Enviar reporte' : 'Enviar propuesta'}
              </button>
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-between">
            <button type="button" onClick={volver} disabled={paso === 0 || enviando || enviado} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:invisible">
              Volver
            </button>
            {paso < pasos.length - 1 && (
              <button type="button" onClick={avanzar} className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:brightness-110">
                Continuar
              </button>
            )}
          </div>
        </section>
          </>
        )}

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          La validación del reporte y la oficialización del semáforo son procesos distintos. Solo el CMJ puede realizar la oficialización.
        </p>
      </div>
    </main>
  )
}
