import React, { useState, useEffect } from 'react';
import { listarSolicitudesVinculacion, resolverSolicitudVinculacion } from '../services/entrenadoresService';

const SolicitudesEntrenadores = () => {
    const [solicitudes, setSolicitudes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [mensaje, setMensaje] = useState('');
    const [resolviendo, setResolviendo] = useState(false);
    const [errorCarga, setErrorCarga] = useState(false);

    const cargarSolicitudes = async () => {
        try {
            setCargando(true);
            setMensaje('');
            setErrorCarga(false);
            const respuesta = await listarSolicitudesVinculacion();
            setSolicitudes(respuesta.data.data || []);
        } catch (error) {
            setErrorCarga(true);
            setMensaje(error.response?.data?.message || 'No se pudieron cargar las solicitudes.');
        } finally {
            setCargando(false);
        }
    };

    const resolver = async (id, estado) => {
        setResolviendo(true);
        setMensaje('');
        try {
            await resolverSolicitudVinculacion(id, estado);
            setSolicitudes(actuales => actuales.filter(sol => sol.id_solicitud_vinculacion !== id));
        } catch (error) {
            setMensaje(error.response?.data?.message || 'No se pudo resolver la solicitud.');
        } finally {
            setResolviendo(false);
        }
    };

    useEffect(() => {
        cargarSolicitudes();
    }, []);

    return (
        <div className="offer-page">
            <div className="offer-container">
                
                {/* Encabezado con contraste corregido */}
                <div className="offer-page-heading flex justify-between items-end mb-6">
                    <div>
                        <span className="offer-eyebrow" style={{ color: 'var(--color-secondary)' }}>
                            GESTIÓN DE ENTRENADORES
                        </span>
                        <h1 style={{ color: 'var(--color-primary)' }}>
                            Solicitudes de vinculación
                        </h1>
                        <p style={{ color: 'var(--color-text-secondary)' }}>
                            Revisa las solicitudes antes de habilitar una vinculación con la disciplina.
                        </p>
                    </div>
                    <button 
                        onClick={cargarSolicitudes}
                        disabled={cargando || resolviendo}
                        className="sivec-button sivec-button-secondary"
                    >
                        Actualizar
                    </button>
                </div>

                {/* Alertas con contraste legible */}
                {mensaje && (
                    <div className="sivec-alert sivec-alert-error mb-6" role="status">
                        {mensaje}
                    </div>
                )}

                {/* Tarjeta y Tabla */}
                {!errorCarga && <div className="sivec-card p-0 overflow-hidden">
                    {cargando ? (
                        <p className="p-6 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                            Cargando solicitudes...
                        </p>
                    ) : solicitudes.length === 0 ? (
                        <div className="p-8 text-center font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                            No hay solicitudes pendientes.
                        </div>
                    ) : (
                        <div className="sivec-table-container border-none">
                            <table className="sivec-table">
                                <thead>
                                    <tr>
                                        <th>Entrenador</th>
                                        <th>Correo / ID</th>
                                        <th>Disciplina</th>
                                        <th>Fecha Solicitud</th>
                                        <th className="text-center">Estado</th>
                                        <th className="text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {solicitudes.map((sol) => (
                                        <tr key={sol.id_solicitud_vinculacion}>
                                            <td className="font-semibold">{sol.nombre_completo}</td>
                                            <td>{sol.correo_electronico}</td>
                                            <td>{sol.disciplina}</td>
                                            <td>{sol.fecha_solicitud}</td>
                                            <td className="text-center">
                                                <span className={`sivec-status sivec-status-${sol.estado === 'APROBADO' ? 'green' : 'yellow'}`}>
                                                    {sol.estado || 'PENDIENTE'}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <button className="sivec-button sivec-button-primary text-xs h-8"
                                                    disabled={resolviendo || cargando}
                                                    onClick={() => resolver(sol.id_solicitud_vinculacion, 'APROBADA')}>
                                                    Aprobar
                                                </button>
                                                <button className="sivec-button sivec-button-secondary text-xs h-8"
                                                    disabled={resolviendo || cargando}
                                                    onClick={() => resolver(sol.id_solicitud_vinculacion, 'RECHAZADA')}>
                                                    Rechazar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>}

            </div>
        </div>
    );
};

export default SolicitudesEntrenadores;
