import React, { useState, useEffect } from 'react';
import { misSolicitudesVinculacion } from '../services/entrenadoresService';

const MisSolicitudesEntrenador = () => {
    const [solicitudes, setSolicitudes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [mensaje, setMensaje] = useState('');
    const [errorCarga, setErrorCarga] = useState(false);

    const cargarSolicitudes = async () => {
        try {
            setCargando(true);
            setMensaje('');
            setErrorCarga(false);
            const respuesta = await misSolicitudesVinculacion();
            setSolicitudes(respuesta.data.data || []);
        } catch (error) {
            setErrorCarga(true);
            setMensaje(error.response?.data?.message || 'No se pudieron cargar las solicitudes.');
        } finally {
            setCargando(false);
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
                            VINCULACIÓN CON DISCIPLINAS
                        </span>
                        <h1 style={{ color: 'var(--color-primary)' }}>
                            Mis solicitudes de vinculación
                        </h1>
                        <p style={{ color: 'var(--color-text-secondary)' }}>
                            Consulta el estado de tus solicitudes por disciplina.
                        </p>
                    </div>
                    <button 
                        onClick={cargarSolicitudes}
                        disabled={cargando}
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
                            Aún no tienes solicitudes de vinculación.
                        </div>
                    ) : (
                        <div className="sivec-table-container border-none">
                            <table className="sivec-table">
                                <thead>
                                    <tr>
                                        <th>Disciplina</th>
                                        <th>Fecha Solicitud</th>
                                        <th className="text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {solicitudes.map((sol) => (
                                        <tr key={sol.id_solicitud_vinculacion}>
                                            <td>{sol.disciplina}</td>
                                            <td>{sol.fecha_solicitud}</td>
                                            <td className="text-center">
                                                <span className={`sivec-status sivec-status-${sol.estado === 'APROBADA' ? 'green' : sol.estado === 'RECHAZADA' ? 'red' : 'yellow'}`}>
                                                    {sol.estado || 'PENDIENTE'}
                                                </span>
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

export default MisSolicitudesEntrenador;
