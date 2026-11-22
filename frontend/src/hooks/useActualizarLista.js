import { useEffect, useEffectEvent } from 'react'

const INTERVALO_MS = 30_000

export default function useActualizarLista(actualizar) {
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

    const intervalo = window.setInterval(revisar, INTERVALO_MS)
    document.addEventListener('visibilitychange', revisar)
    window.addEventListener('online', revisar)
    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', revisar)
      window.removeEventListener('online', revisar)
    }
  }, [])
}
