import React, { useState, useEffect } from 'react';
import { listarSolicitudesVinculacion, resolverSolicitudVinculacion } from '../services/entrenadoresService';

const SolicitudesEntrenadores = () => {
    const [solicitudes, setSolicitudes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [mensaje, setMensaje] = useState(null);
    const [resolviendo, setResolviendo] = useState(false);
    const [errorCarga, setErrorCarga] = useState(false);

    const cargarSolicitudes = async () => {
        try {
            setCargando(true);
            setMensaje(null);
            setErrorCarga(false);
            const respuesta = await listarSolicitudesVinculacion();
            setSolicitudes(respuesta.data.data || []);
        } catch (error) {
            setErrorCarga(true);
            setMensaje({ tipo: 'error', texto: error.response?.data?.message || 'No se pudieron cargar las solicitudes.' });
        } finally {
            setCargando(false);
        }
    };

    const resolver = async (id, estado) => {
        setResolviendo(true);
        setMensaje(null);
        try {
            const { data } = await resolverSolicitudVinculacion(id, estado);
            setSolicitudes(actuales => actuales.filter(sol => sol.id_solicitud_vinculacion !== id));
            setMensaje({ tipo: 'success', texto: data.message });
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error.response?.data?.message || 'No se pudo resolver la solicitud.' });
        } finally {
            setResolviendo(false);
        }
    };

    useEffect(() => {
        cargarSolicitudes();
    }, []);

    return (
        <div className="offer-page min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <header className="offer-page-heading mb-6">
                    <span className="block mb-2 text-sm font-semibold uppercase tracking-wide text-green-700">
                        Gestión de entrenadores
                    </span>
                    <h1>Solicitudes de vinculación</h1>
                    <p>Revisa las solicitudes de los entrenadores para vincularse a una disciplina.</p>
                </header>

                <section aria-labelledby="solicitudes-pendientes" className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <header className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                        <h2 id="solicitudes-pendientes" className="text-lg font-semibold text-gray-800">Solicitudes pendientes</h2>
                        <button type="button" onClick={cargarSolicitudes} disabled={cargando || resolviendo} className="offer-button offer-button-secondary">
                            Actualizar
                        </button>
                    </header>

                    {mensaje && (
                        <p className={`sivec-alert sivec-alert-${mensaje.tipo} m-6`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>
                            {mensaje.texto}
                        </p>
                    )}

                    {!errorCarga && (
                        cargando || solicitudes.length === 0 ? (
                            <p className="p-6 text-center text-sm text-gray-600" role="status">
                                {cargando ? 'Cargando solicitudes…' : 'No hay solicitudes pendientes.'}
                            </p>
                        ) : (
                            <div className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2" role="region" aria-label="Tabla de solicitudes pendientes" tabIndex={0}>
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 font-medium">Entrenador</th>
                                            <th scope="col" className="px-6 py-3 font-medium">Disciplina</th>
                                            <th scope="col" className="px-6 py-3 font-medium whitespace-nowrap">Fecha de solicitud</th>
                                            <th scope="col" className="px-6 py-3 font-medium text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm divide-y divide-gray-100">
                                        {solicitudes.map(sol => (
                                            <tr key={sol.id_solicitud_vinculacion} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-gray-900">{sol.nombre_completo}</div>
                                                    {sol.correo_electronico && <div className="text-xs text-gray-600 mt-1">{sol.correo_electronico}</div>}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-gray-700">{sol.disciplina}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{sol.fecha_solicitud}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button type="button" className="offer-button offer-button-primary"
                                                            disabled={resolviendo}
                                                            aria-label={`Aprobar solicitud de ${sol.nombre_completo} para ${sol.disciplina}`}
                                                            onClick={() => resolver(sol.id_solicitud_vinculacion, 'APROBADA')}>
                                                            Aprobar
                                                        </button>
                                                        <button type="button" className="offer-button offer-button-secondary"
                                                            disabled={resolviendo}
                                                            aria-label={`Rechazar solicitud de ${sol.nombre_completo} para ${sol.disciplina}`}
                                                            onClick={() => resolver(sol.id_solicitud_vinculacion, 'RECHAZADA')}>
                                                            Rechazar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </section>
            </div>
        </div>
    );
};

export default SolicitudesEntrenadores;
