import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const PanelEntrenador = () => {
    // 1. Datos simulados de la Agenda
    const [agenda] = useState([
        { id: 1, dia: 'LUNES', horario: '16:00 - 18:00', disciplina: 'Fútbol sala', escenario: 'Coliseo Municipal', entrenador: 'Laura Gómez', vigencia: '2026-11-01 → sin cierre' },
        { id: 2, dia: 'LUNES', horario: '17:00 - 19:00', disciplina: 'Danza folclórica', escenario: 'Coliseo Municipal', entrenador: 'Laura Gómez', vigencia: '2026-11-01 → sin cierre' },
        { id: 3, dia: 'MARTES', horario: '16:00 - 18:00', disciplina: 'Fútbol sala', escenario: 'Estadio Municipal', entrenador: 'Laura Gómez', vigencia: '2026-11-06 → sin cierre' }
    ]);

    // 2. Datos simulados de Deportistas Inscritos
    const [deportistasInscritos] = useState([
        { id: 1, disciplina: 'Danza folclórica', deportista: 'Juan Jose', fechaInscripcion: '2026-10-28 09:47:38' },
        { id: 2, disciplina: 'Fútbol sala', deportista: 'Carlos Pérez', fechaInscripcion: '2026-10-27 21:27:51' }
    ]);

    // 3. Estado para la búsqueda
    const [busqueda, setBusqueda] = useState({
        nombre: '',
        disciplina: ''
    });

    const handleBusquedaChange = (e) => {
        setBusqueda({ ...busqueda, [e.target.name]: e.target.value });
    };

    const handleBuscar = (e) => {
        e.preventDefault();
        console.log('Buscando deportista con:', busqueda);
        // Lógica de filtrado o llamada a API
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* --- Encabezado Principal --- */}
                <div>
                    <h1 className="text-3xl font-extrabold text-[#173F35]">
                        Panel del entrenador
                    </h1>
                </div>

                {/* --- SECCIÓN 1: Mi Agenda --- */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-800">Mi agenda</h2>
                        <Link 
                            to="/entrenador/agenda" 
                            className="text-sm font-semibold text-[#173F35] hover:underline"
                        >
                            Administrar mi agenda
                        </Link>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                                    <th className="px-6 py-3 font-semibold">Día</th>
                                    <th className="px-6 py-3 font-semibold">Horario</th>
                                    <th className="px-6 py-3 font-semibold">Disciplina</th>
                                    <th className="px-6 py-3 font-semibold">Escenario</th>
                                    <th className="px-6 py-3 font-semibold">Entrenador</th>
                                    <th className="px-6 py-3 font-semibold">Vigencia</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-100">
                                {agenda.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-[#173F35]">{item.dia}</td>
                                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{item.horario}</td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{item.disciplina}</td>
                                        <td className="px-6 py-4 text-gray-600">{item.escenario}</td>
                                        <td className="px-6 py-4 text-gray-600">{item.entrenador}</td>
                                        <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">{item.vigencia}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* --- SECCIÓN 2: Deportistas inscritos en mis disciplinas --- */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h2 className="text-lg font-bold text-gray-800">Deportistas inscritos en mis disciplinas</h2>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                                    <th className="px-6 py-3 font-semibold">Disciplina</th>
                                    <th className="px-6 py-3 font-semibold">Deportista</th>
                                    <th className="px-6 py-3 font-semibold">Inscrito el</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-100">
                                {deportistasInscritos.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-[#173F35]">{item.disciplina}</td>
                                        <td className="px-6 py-4 font-semibold text-gray-900">{item.deportista}</td>
                                        <td className="px-6 py-4 text-gray-500">{item.fechaInscripcion}</td>
                                    </tr>
                                ))}
                                {deportistasInscritos.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-6 text-center text-gray-500 italic">
                                            No hay deportistas inscritos actualmente.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* --- SECCIÓN 3: Buscar deportistas --- */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Buscar deportistas</h2>
                    
                    <form onSubmit={handleBuscar} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nombre del deportista
                            </label>
                            <input 
                                type="text"
                                name="nombre"
                                value={busqueda.nombre}
                                onChange={handleBusquedaChange}
                                placeholder="Escribe un nombre..."
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#173F35] focus:border-[#173F35] outline-none text-sm bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Deporte o disciplina
                            </label>
                            <input 
                                type="text"
                                name="disciplina"
                                value={busqueda.disciplina}
                                onChange={handleBusquedaChange}
                                placeholder="Ej. Fútbol sala..."
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#173F35] focus:border-[#173F35] outline-none text-sm bg-white"
                            />
                        </div>

                        <div>
                            <button 
                                type="submit"
                                className="w-full bg-[#173F35] text-white font-bold py-2.5 px-6 rounded-lg hover:bg-green-900 transition-colors text-sm shadow-sm"
                            >
                                Buscar
                            </button>
                        </div>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default PanelEntrenador;