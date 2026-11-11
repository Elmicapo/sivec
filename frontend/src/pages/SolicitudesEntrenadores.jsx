import React, { useState, useEffect } from 'react';
import api from '../services/api';

const SolicitudesEntrenadores = () => {
    const [solicitudes, setSolicitudes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [mensaje, setMensaje] = useState({ tipo: 'error', texto: 'Token inválido o expirado.' });

    const cargarSolicitudes = async () => {
        try {
            setCargando(true);
            const respuesta = await api.get('/admin/solicitudes-entrenadores');
            setSolicitudes(respuesta.data.data || []);
        } catch (error) {
            setMensaje({ tipo: 'error', texto: 'Token inválido o expirado.' });
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
                        className="sivec-button sivec-button-secondary"
                    >
                        Actualizar
                    </button>
                </div>

                {/* Alertas con contraste legible */}
                {mensaje.texto && (
                    <div className={`sivec-alert sivec-alert-${mensaje.tipo} mb-6`} role="status">
                        {mensaje.texto}
                    </div>
                )}

                {/* Tarjeta y Tabla */}
                <div className="sivec-card p-0 overflow-hidden">
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
                                        <tr key={sol.id_solicitud}>
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
                                                <button className="sivec-button sivec-button-primary text-xs h-8">
                                                    Aprobar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default SolicitudesEntrenadores;