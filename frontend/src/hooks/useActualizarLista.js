import { useEffect, useEffectEvent } from 'react'
import api from '../services/api'
import { CLAVE_CAMBIO_DISCIPLINAS } from '../services/actualizacionDisciplinas'

const INTERVALO_MS = 4_000

export default function useActualizarLista(actualizar, observarDisciplinas = false) {
  const consultar = useEffectEvent(actualizar)

  useEffect(() => {
    let consultando = false
    let cambioPendiente = false
    const revisar = async () => {
      if (consultando || document.visibilityState !== 'visible' || !navigator.onLine) return
      consultando = true
      try {
        await consultar()
      } finally {
        consultando = false
        if (cambioPendiente) {
          cambioPendiente = false
          void revisar()
        }
      }
    }

    const sincronizar = () => {
      if (consultando) cambioPendiente = true
      else void revisar()
    }
    const cambioDisciplina = event => {
      if (event.key === CLAVE_CAMBIO_DISCIPLINAS) sincronizar()
    }
    const eventos = observarDisciplinas && typeof EventSource !== 'undefined'
      ? new EventSource(api.getUri({ url: '/disciplinas/eventos' }))
      : null
    eventos?.addEventListener('disciplinas', sincronizar)
    if (observarDisciplinas) window.addEventListener('storage', cambioDisciplina)
    const intervalo = window.setInterval(revisar, INTERVALO_MS)
    document.addEventListener('visibilitychange', revisar)
    window.addEventListener('online', revisar)
    return () => {
      eventos?.close()
      cambioPendiente = false
      window.removeEventListener('storage', cambioDisciplina)
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', revisar)
      window.removeEventListener('online', revisar)
    }
  }, [observarDisciplinas])
}
