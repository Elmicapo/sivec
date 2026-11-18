import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'
import { borrarHistorialSesion } from '../services/historialSesion'

const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

function leerUsuario() {
  try { return JSON.parse(localStorage.getItem('usuario')) } catch { return null }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(leerUsuario)

  useEffect(() => {
    const sincronizar = event => {
      if (event.storageArea === localStorage && (event.key === 'usuario' || event.key === null)) {
        borrarHistorialSesion()
        setUsuario(leerUsuario())
      }
    }
    window.addEventListener('storage', sincronizar)
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  const login = async (credencial, password) => {
    const { data } = await api.post('/auth/login', { login: credencial, password })
    borrarHistorialSesion()
    localStorage.setItem('token', data.token)
    localStorage.setItem('usuario', JSON.stringify(data.usuario))
    setUsuario(data.usuario)
    return data.usuario
  }

  const logout = () => {
    borrarHistorialSesion()
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}