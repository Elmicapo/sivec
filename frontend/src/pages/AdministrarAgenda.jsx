import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';

const AdministrarAgenda = () => {
    // 1. Estado inicializado de forma segura
    const [agenda, setAgenda] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [formData, setFormData] = useState({
        dia: 'LUNES',
        hora_inicio: '',
        hora_fin: '',
        id_deporte_escenario: '',
        vigencia: ''
    });

    // 2. Función para cargar la agenda con validaciones de tipo de dato
    const cargarAgenda = async () => {
        try {
            setCargando(true);
            const res = await API.get('/agenda/entrenador');

            // Validación clave: Asegurarnos de que siempre sea un Array
            if (Array.isArray(res.data)) {
                setAgenda(res.data);
            } else if (res.data && Array.isArray(res.data.data)) {
                setAgenda(res.data.data);
            } else if (res.data && Array.isArray(res.data.agenda)) {
                setAgenda(res.data.agenda);
            } else {
                setAgenda([]);
            }
        } catch (error) {
            console.error("Error al cargar la agenda:", error);
            setAgenda([]); // Mantiene el componente vivo aunque falle el servidor
        } finally {
            setCargando(false);
        }
    };

    // Cargar al montar el componente
    useEffect(() => {
        cargarAgenda();
    }, []);

    // 3. Manejadores de eventos del formulario
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await API.post('/agenda', formData);

            alert('Horario agregado correctamente');
            setFormData({ dia: 'LUNES', hora_inicio: '', hora_fin: '', id_deporte_escenario: '', vigencia: '' });
            cargarAgenda();
        } catch (error) {
            console.error("Error al guardar:", error);
            alert('Error al guardar el horario en la agenda');
        }
    };

    const handleEliminar = async (id) => {
        if (!window.confirm('¿Deseas eliminar este horario?')) return;
        try {
            await API.delete(`/agenda/${id}`);

            setAgenda(prev => Array.isArray(prev) ? prev.filter(item => item.id !== id && item.id_agenda !== id) : []);
        } catch (error) {
            console.error("Error al eliminar:", error);
            alert('Error al eliminar el horario');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* --- Encabezado --- */}
                <div>
                    <Link to="/entrenador" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-[#173F35] mb-4 transition-colors">
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Volver al Panel del entrenador
                    </Link>
                    <h1 className="text-3xl font-extrabold text-[#173F35] mb-2">Administrar mi agenda</h1>
                    <p className="text-gray-600">Programa tus horarios y gestiona los espacios asignados.</p>
                </div>

                {/* --- Formulario --- */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-3">Programar nuevo horario</h2>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            
                            {/* Día */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Día de la semana</label>
                                <select 
                                    name="dia" 
                                    value={formData.dia} 
                                    onChange={handleChange} 
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#173F35] outline-none text-sm bg-white"
                                    required
                                >
                                    <option value="LUNES">Lunes</option>
                                    <option value="MARTES">Martes</option>
                                    <option value="MIERCOLES">Miércoles</option>
                                    <option value="JUEVES">Jueves</option>
                                    <option value="VIERNES">Viernes</option>
                                    <option value="SABADO">Sábado</option>
                                    <option value="DOMINGO">Domingo</option>
                                </select>
                            </div>

                            {/* Horas */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Hora Inicio</label>
                                    <input 
                                        type="time" 
                                        name="hora_inicio" 
                                        value={formData.hora_inicio} 
                                        onChange={handleChange} 
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Hora Fin</label>
                                    <input 
                                        type="time" 
                                        name="hora_fin" 
                                        value={formData.hora_fin} 
                                        onChange={handleChange} 
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm"
                                        required 
                                    />
                                </div>
                            </div>

                            {/* Vigencia */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Fecha límite (Opcional)</label>
                                <input 
                                    type="date" 
                                    name="vigencia" 
                                    value={formData.vigencia} 
                                    onChange={handleChange} 
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end mt-2 pt-4 border-t border-gray-100">
                            <button type="submit" className="bg-[#173F35] text-white px-6 py-2.5 rounded-lg hover:bg-green-900 transition-colors text-sm font-bold shadow-sm">
                                Agregar a la agenda
                            </button>
                        </div>
                    </form>
                </div>

                {/* --- Tabla de Horarios --- */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h2 className="text-lg font-bold text-gray-800">Horarios configurados</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                                    <th className="px-6 py-3 font-semibold">Día</th>
                                    <th className="px-6 py-3 font-semibold">Horario</th>
                                    <th className="px-6 py-3 font-semibold">Disciplina</th>
                                    <th className="px-6 py-3 font-semibold">Escenario</th>
                                    <th className="px-6 py-3 font-semibold">Vigencia</th>
                                    <th className="px-6 py-3 font-semibold text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-100">
                                {cargando ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center text-gray-500 italic">Cargando agenda...</td>
                                    </tr>
                                ) : !Array.isArray(agenda) || agenda.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center text-gray-500 italic">No hay horarios registrados en tu agenda.</td>
                                    </tr>
                                ) : (
                                    agenda.map((item) => {
                                        // Aseguramos obtener un id único dependiendo de cómo lo devuelva el backend
                                        const uniqueId = item.id || item.id_agenda;
                                        return (
                                            <tr key={uniqueId} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-[#173F35]">{item.dia}</td>
                                                <td className="px-6 py-4 text-gray-700">{item.hora_inicio} - {item.hora_fin}</td>
                                                <td className="px-6 py-4 font-medium text-gray-900">{item.disciplina}</td>
                                                <td className="px-6 py-4 text-gray-600">{item.escenario}</td>
                                                <td className="px-6 py-4 text-xs text-gray-500">{item.vigencia || 'Sin cierre'}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => handleEliminar(uniqueId)}
                                                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdministrarAgenda;