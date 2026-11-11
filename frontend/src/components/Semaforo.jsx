const COLORES = {
  VERDE: 'sivec-status sivec-status-green',
  AMARILLO: 'sivec-status sivec-status-yellow',
  ROJO: 'sivec-status sivec-status-red'
}

const TEXTOS = {
  VERDE: 'Buen estado',
  AMARILLO: 'En mantenimiento',
  ROJO: 'Deteriorado'
}

export default function Semaforo({ estado }) {
  return (
    <span
      aria-label={`Estado del escenario: ${TEXTOS[estado] || 'No disponible'}`}
      className={COLORES[estado] || 'sivec-status sivec-status-neutral'}
    >
      {estado} · {TEXTOS[estado] || ''}
    </span>
  )
}