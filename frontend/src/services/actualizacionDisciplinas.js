export const CLAVE_CAMBIO_DISCIPLINAS = 'sivec:cambio-disciplinas'

export function avisarCambioDisciplinas() {
  try {
    localStorage.setItem(CLAVE_CAMBIO_DISCIPLINAS, crypto.randomUUID())
  } catch {
    // Las pestañas aún consultan periódicamente si el almacenamiento está bloqueado.
  }
}
