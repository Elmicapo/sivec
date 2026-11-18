import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const INICIO = {
  ADMINISTRATIVO: '/admin',
  ENTRENADOR: '/entrenador',
  DEPORTISTA: '/deportista',
  CMJ: '/cmj'
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (event) => {
    event.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const usuario = await login(correo.trim(), password)
      const destinoSolicitado = location.state?.from?.pathname
      navigate(destinoSolicitado || INICIO[usuario.rol] || '/', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Credenciales inválidas o usuario inactivo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    // Se retiró el "my-8" (margen vertical) para evitar la barra de desplazamiento
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 mx-auto border border-gray-100">
        
        {/* Encabezado */}
        <div className="mb-8">
            <span className="text-xs font-bold tracking-widest text-[#173F35] uppercase mb-2 block">
                Bienvenido de nuevo
            </span>
            <h1 id="auth-modal-title" className="text-3xl font-extrabold text-[#173F35] mb-2">
                Iniciar sesión
            </h1>
            <p className="text-gray-500 text-sm">
                Accede a tu espacio de deporte y ciudadanía.
            </p>
        </div>

        {/* Alerta de Error */}
        {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-3 rounded-md flex items-center" role="alert">
                <svg className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-red-800">{error}</span>
            </div>
        )}

        {/* Formulario */}
        <form onSubmit={enviar} className="space-y-5">
            
            {/* Campo: Correo Electrónico */}
            <div>
                <label className="block text-sm font-bold text-gray-900 mb-1.5">
                    Correo electrónico
                </label>
                <input
                    autoComplete="email"
                    autoFocus
                    type="email"
                    value={correo}
                    onChange={(event) => setCorreo(event.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#173F35] focus:border-[#173F35] outline-none transition-all text-gray-900 bg-white"
                    placeholder="nombre@correo.com"
                    required
                />
            </div>

            {/* Campo: Contraseña (Con el botón de Mostrar integrado) */}
            <div>
                <label className="block text-sm font-bold text-gray-900 mb-1.5">
                    Contraseña
                </label>
                <div className="relative">
                    <input
                        autoComplete="current-password"
                        type={mostrarPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        // pr-20 deja el espacio interno a la derecha para que el botón no pise el texto
                        className="w-full pl-4 pr-20 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#173F35] focus:border-[#173F35] outline-none transition-all text-gray-900 bg-white"
                        placeholder="Escribe tu contraseña"
                        required
                    />
                    
                    {/* Botón Mostrar/Ocultar nativo integrado dentro del input */}
                    <button
                        aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        type="button"
                        onClick={() => setMostrarPassword(!mostrarPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#173F35] hover:text-green-800 focus:outline-none bg-transparent"
                    >
                        {mostrarPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                </div>
            </div>

            {/* Botón de Submit (con estado de carga) */}
            <button 
                type="submit"
                disabled={enviando}
                className={`w-full bg-[#173F35] text-white font-bold text-base py-3.5 rounded-lg hover:bg-green-900 transition-colors mt-4 shadow-sm flex items-center justify-center ${enviando ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
                {enviando ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verificando...
                    </>
                ) : 'Iniciar sesión'}
            </button>
        </form>

        <p className="mt-5 text-center text-sm">
            <Link to="/recuperar-contrasena" className="font-semibold text-[#173F35] hover:underline">¿Olvidaste tu contraseña?</Link>
        </p>
        {/* Pie del modal (Enlace a Registro) */}
        <p className="mt-8 text-center text-sm text-gray-600">
            ¿No tienes cuenta?{' '}
            <Link state={location.state} to="/registro" className="font-bold text-[#173F35] hover:underline transition-all">
                Regístrate
            </Link>
        </p>
        
    </div>
  )
}