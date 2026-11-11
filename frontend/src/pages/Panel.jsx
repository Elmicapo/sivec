import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Panel() {
  const { usuario, logout } = useAuth()
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-md p-6 space-y-3">
        <h1 className="text-2xl font-bold">Panel {usuario.rol}</h1>
        <p>Hola, {usuario.nombre}.</p>
        <div className="flex gap-4">
          <Link to="/" className="text-blue-600 underline">Ir al inicio</Link>
          <button onClick={logout} className="text-red-600 underline">Cerrar sesión</button>
        </div>
      </div>
    </div>
  )
}