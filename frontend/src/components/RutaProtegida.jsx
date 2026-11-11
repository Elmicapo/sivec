import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RutaProtegida({ roles, children }) {
  const { usuario } = useAuth()
  const location = useLocation()
  if (!usuario) return <Navigate state={{ from: location }} to="/login" replace />
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />
  return children
}