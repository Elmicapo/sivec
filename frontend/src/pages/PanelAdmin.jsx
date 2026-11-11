// frontend/src/pages/PanelAdmin.jsx
import React, { useState, useEffect } from 'react';
import FormularioCronograma from '../components/FormularioCronograma';
import api, { darDeBajaCronograma } from '../services/api'; 

const PanelAdmin = () => {
    const [cronogramas, setCronogramas] = useState([]);
    const [cargando, setCargando] = useState(true);

    const cargarCronogramas = async () => {
        try {
            setCargando(true);
            const respuesta = await api.get('/disciplinas/cronograma');
            setCronogramas(respuesta.data.data || []);
        } catch (error) {
            console.error("Error al cargar cronogramas:", error);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarCronogramas();
    }, []);

    const handleEliminar = async (idCronograma) => {
        if (!window.confirm('¿Estás seguro de que deseas dar de baja este horario?')) return;
        try {
            const respuesta = await darDeBajaCronograma(idCronograma);
            if (respuesta.success) {
                alert('Cronograma dado de baja exitosamente');
                cargarCronogramas(); 
            }
        } catch (error) {
            alert('Error al desactivar el cronograma');
        }
    };

return (
        <div className="bg-gray-900 min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                <h2 className="text-3xl font-bold text-green-400 mb-8 border-b border-gray-700 pb-4">
                    Panel Administrativo - Gestión de Cronogramas
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 1. CONTENEDOR DEL FORMULARIO AHORA USA SIVEC-CARD */}
                    <div className="lg:col-span-1 sivec-card h-fit">
                        <FormularioCronograma onSuccess={cargarCronogramas} />
                    </div>

                    {/* 2. CONTENEDOR DE LA TABLA AHORA USA SIVEC-CARD */}
                    <div className="lg:col-span-2 sivec-card">
                        <h3 className="text-xl font-semibold mb-4 text-gray-200">Horarios Registrados</h3>
                        
                        {cargando ? (
                            <p className="text-gray-400">Cargando cronogramas...</p>
                        ) : (
                            /* 3. APLICACIÓN DE SIVEC-TABLE-CONTAINER Y SIVEC-TABLE */
                            <div className="sivec-table-container">
                                <table className="sivec-table">
                                    <thead>
                                        <tr>
                                            {/* Las clases de padding, colores y bordes se eliminaron; ahora las controla index.css */}
                                            <th>Día</th>
                                            <th>Horario</th>
                                            <th>Disciplina</th>
                                            <th>Escenario</th>
                                            <th>Entrenador</th>
                                            <th className="text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cronogramas.map((crono) => (
                                            <tr key={crono.id_cronograma}>
                                                <td className="font-semibold">{crono.dia_semana}</td>
                                                <td>{crono.hora_inicio.substring(0, 5)} - {crono.hora_fin.substring(0, 5)}</td>
                                                <td>{crono.disciplina}</td>
                                                <td>{crono.escenario}</td>
                                                <td>{crono.entrenador}</td>
                                                <td className="text-center">
                                                    <button 
                                                        onClick={() => handleEliminar(crono.id_cronograma)}
                                                        className="bg-red-600/80 hover:bg-red-500 text-white px-3 py-1 rounded text-xs transition"
                                                    >
                                                        Dar de baja
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {cronogramas.length === 0 && !cargando && (
                            <p className="text-gray-400 mt-4 text-center">No hay cronogramas activos registrados.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
    export default PanelAdmin;