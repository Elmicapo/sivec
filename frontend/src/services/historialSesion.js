const CLAVE = 'sivec:historial-deportista'

export function guardarHistorialSesion(idPersona, historial) {
  if (!idPersona || !Array.isArray(historial)) return
  const filas = historial.map(({ disciplina, fecha_inscripcion, estado }) => ({ disciplina, fecha_inscripcion, estado }))
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ idPersona, filas, fecha: Date.now() }))
  } catch {
    // La consulta en línea funciona aunque el navegador bloquee el almacenamiento.
  }
}

export function leerHistorialSesion(idPersona) {
  if (!idPersona) return null
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CLAVE))
    return guardado?.idPersona === idPersona ? guardado : null
  } catch {
    return null
  }
}

export function borrarHistorialSesion() {
  try {
    sessionStorage.removeItem(CLAVE)
  } catch {
    // El almacenamiento puede estar deshabilitado.
  }
}
