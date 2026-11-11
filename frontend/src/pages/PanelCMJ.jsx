import React, { useState } from 'react';

const PanelCMJ = () => {
    // Estados simulados basados en la imagen
    const [error, setError] = useState("No se pudieron cargar los reportes");
    const [pendientes, setPendientes] = useState([]);
    const [oficializacion, setOficializacion] = useState([]);
    const [propuestas, setPropuestas] = useState([]);
    const [historico, setHistorico] = useState([]);

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* --- Encabezado --- */}
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-[#173F35] mb-2">
                        Veeduría de escenarios (CMJ)
                    </h1>
                    <p className="text-gray-600">
                        La validación y la oficialización del semáforo son operaciones independientes.
                    </p>
                </div>

                {/* --- Alerta de Error --- */}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-center shadow-sm">
                        <svg className="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span className="text-sm font-medium text-red-800">{error}</span>
                    </div>
                )}

                {/* --- Grilla de Colas de Trabajo --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    
                    {/* Tarjeta: Reportes Pendientes */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-base font-bold text-gray-800">Reportes pendientes</h2>
                            <span className="bg-gray-200 text-gray-700 py-0.5 px-2.5 rounded-full text-xs font-bold">
                                {pendientes.length}
                            </span>
                        </div>
                        <div className="p-5 flex-grow flex items-center justify-center">
                            {pendientes.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center italic">No hay reportes pendientes.</p>
                            ) : (
                                /* Aquí iría la lista de pendientes */
                                <div>Cargando...</div>
                            )}
                        </div>
                    </div>

                    {/* Tarjeta: Pendientes de Oficialización */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-base font-bold text-gray-800">Pendientes de oficialización</h2>
                            <span className="bg-blue-100 text-blue-700 py-0.5 px-2.5 rounded-full text-xs font-bold">
                                {oficializacion.length}
                            </span>
                        </div>
                        <div className="p-5 flex-grow flex items-center justify-center">
                            {oficializacion.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center italic">No hay reportes validados pendientes de oficialización.</p>
                            ) : (
                                <div>Cargando...</div>
                            )}
                        </div>
                    </div>

                    {/* Tarjeta: Propuestas de Escenarios */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-base font-bold text-gray-800">Propuestas de escenarios</h2>
                            <span className="bg-green-100 text-green-700 py-0.5 px-2.5 rounded-full text-xs font-bold">
                                {propuestas.length}
                            </span>
                        </div>
                        <div className="p-5 flex-grow flex items-center justify-center">
                            {propuestas.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center italic">No hay propuestas pendientes.</p>
                            ) : (
                                <div>Cargando...</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- Tabla: Histórico de Veedurías --- */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-8">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h2 className="text-lg font-semibold text-gray-800">Histórico de veedurías</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                                    <th className="px-6 py-4 font-medium whitespace-nowrap">Escenario</th>
                                    <th className="px-6 py-4 font-medium whitespace-nowrap">Reportante</th>
                                    <th className="px-6 py-4 font-medium whitespace-nowrap">Propuesto</th>
                                    <th className="px-6 py-4 font-medium whitespace-nowrap">Estado</th>
                                    <th className="px-6 py-4 font-medium whitespace-nowrap">Validó</th>
                                    <th className="px-6 py-4 font-medium whitespace-nowrap">Fecha</th>
                                    <th className="px-6 py-4 font-medium">Observación</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-100">
                                {historico.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-8 text-center text-gray-500 italic bg-white">
                                            Todavía no hay reportes en el histórico.
                                        </td>
                                    </tr>
                                ) : (
                                    historico.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                                            {/* Filas de datos cuando existan */}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PanelCMJ;