import React, { useState } from 'react';
// Si el formulario lo tienes en un archivo separado, impórtalo aquí.
// import FormularioCronograma from './FormularioCronograma'; 

const AdministrarDisciplinas = () => {
    // 1. Estados para crear una Disciplina (Básico)
    const [formData, setFormData] = useState({
        nombre: '',
        categoria: 'DEPORTIVA',
        poblacion: '',
        cupo_maximo: ''
    });

    // 2. Datos de ejemplo para listar en la tabla de disciplinas
    const [disciplinas, setDisciplinas] = useState([
        { 
            id: 1, 
            nombre: 'Fútbol sala', 
            categoria: 'DEPORTIVA', 
            poblacion: 'Jóvenes 14-28', 
            cupos: '1/1', 
            escenarios: 'Coliseo Municipal, Estadio Municipal' 
        },
        { 
            id: 2, 
            nombre: 'Natación', 
            categoria: 'DEPORTIVA', 
            poblacion: 'Estudiantes', 
            cupos: '1/8', 
            escenarios: '—' 
        },
        { 
            id: 3, 
            nombre: 'Danza folclórica', 
            categoria: 'CULTURAL', 
            poblacion: 'Todas las edades', 
            cupos: '1/30', 
            escenarios: 'Cancha Sintética Barrio Centro, Coliseo Municipal' 
        }
    ]);

    // --- Manejadores de Disciplinas ---
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Datos de Disciplina enviados:', formData);
    };

    const handleEliminar = (id) => {
        if (!window.confirm('¿Estás seguro de que deseas dar de baja esta disciplina?')) return;
        setDisciplinas(disciplinas.filter(d => d.id !== id));
    };

    return (
        <div className="offer-page min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* --- Encabezado Principal --- */}
                <div className="offer-page-heading mb-6">
                    <span className="text-sm font-semibold tracking-wide text-green-700 uppercase mb-2 block">
                        ADMINISTRACIÓN DE OFERTA
                    </span>
                    <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Administrar disciplinas</h1>
                    <p className="text-gray-600">Crea nuevas disciplinas deportivas o culturales y gestiona su configuración.</p>
                </div>

                {/* --- Formulario de NUEVA DISCIPLINA --- */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-3">Nueva disciplina</h2>
                    
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="nombre">Nombre</label>
                                <input 
                                    id="nombre" type="text" name="nombre"
                                    placeholder="Ej. Fútbol sala" 
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-sm p-2.5 border"
                                    value={formData.nombre} onChange={handleChange} required 
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="categoria">Categoría</label>
                                <select 
                                    id="categoria" name="categoria"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-sm p-2.5 border bg-white"
                                    value={formData.categoria} onChange={handleChange} required
                                >
                                    <option value="DEPORTIVA">Deportiva</option>
                                    <option value="CULTURAL">Cultural</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="poblacion">Población</label>
                                <input 
                                    id="poblacion" type="text" name="poblacion"
                                    placeholder="Ej. Jóvenes 14-28" 
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-sm p-2.5 border"
                                    value={formData.poblacion} onChange={handleChange} required 
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="cupo_maximo">Cupo máximo</label>
                                <input 
                                    id="cupo_maximo" type="number" name="cupo_maximo"
                                    placeholder="Ej. 30" 
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-sm p-2.5 border"
                                    value={formData.cupo_maximo} onChange={handleChange} required 
                                />
                            </div>
                        </div>
                        
                        <div className="flex justify-end mt-2">
                            <button type="submit" className="bg-[#173F35] text-white px-6 py-2.5 rounded-md hover:bg-green-800 transition-colors text-sm font-medium shadow-sm">
                                Crear disciplina
                            </button>
                        </div>
                    </form>
                </div>

                {/* --- TABLA DE DISCIPLINAS ESTANDARIZADA --- */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-800">Disciplinas Registradas</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                                    <th className="px-6 py-3 font-medium whitespace-nowrap">Nombre</th>
                                    <th className="px-6 py-3 font-medium whitespace-nowrap">Categoría</th>
                                    <th className="px-6 py-3 font-medium whitespace-nowrap">Población</th>
                                    <th className="px-6 py-3 font-medium whitespace-nowrap">Cupos</th>
                                    <th className="px-6 py-3 font-medium">Escenarios</th>
                                    <th className="px-6 py-3 font-medium text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-100">
                                {disciplinas.map((disc) => (
                                    <tr key={disc.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap">
                                            {disc.nombre}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                disc.categoria === 'CULTURAL' 
                                                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                                : 'bg-[#E5EFEA] text-[#173F35] border-[#b0d8c4]'
                                            }`}>
                                                {disc.categoria}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{disc.poblacion}</td>
                                        <td className="px-6 py-4 font-medium text-gray-700 whitespace-nowrap">{disc.cupos}</td>
                                        <td className="px-6 py-4 text-gray-500 max-w-xs truncate" title={disc.escenarios}>{disc.escenarios}</td>
                                        
                                        {/* Botones de acción alineados y proporcionales */}
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            <div className="flex justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => console.log('Editar', disc.id)}
                                                    className="text-[#173F35] hover:text-green-700 font-medium text-sm transition-colors"
                                                >
                                                    Editar
                                                </button>
                                                <span className="text-gray-300">|</span>
                                                <button 
                                                    onClick={() => handleEliminar(disc.id)}
                                                    className="text-red-600 hover:text-red-800 font-medium text-sm transition-colors"
                                                >
                                                    Dar de baja
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdministrarDisciplinas;