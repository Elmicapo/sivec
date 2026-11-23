import { useEffect, useEffectEvent } from 'react'
import { CLAVE_CAMBIO_DISCIPLINAS } from '../services/actualizacionDisciplinas'

const INTERVALO_MS = 4_000

export default function useActualizarLista(actualizar, observarDisciplinas = false) {
  const consultar = useEffectEvent(actualizar)

  useEffect(() => {
    let consultando = false
    const revisar = async () => {
      if (consultando || document.visibilityState !== 'visible' || !navigator.onLine) return
      consultando = true
      try {
        await consultar()
      } finally {
        consultando = false
      }
    }

    const cambioDisciplina = event => {
      if (event.key === CLAVE_CAMBIO_DISCIPLINAS) void revisar()
    }
    if (observarDisciplinas) window.addEventListener('storage', cambioDisciplina)
    const intervalo = window.setInterval(revisar, INTERVALO_MS)
    document.addEventListener('visibilitychange', revisar)
    window.addEventListener('online', revisar)
    return () => {
      window.removeEventListener('storage', cambioDisciplina)
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', revisar)
      window.removeEventListener('online', revisar)
    }
  }, [observarDisciplinas])
}
