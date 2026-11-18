import React, { useState, useEffect } from 'react';
import { getDisciplinasActivas } from '../services/deportesService';
import { misSolicitudesVinculacion, solicitarVinculacion } from '../services/entrenadoresService';

const MisSolicitudesEntrenador = () => {
    const [solicitudes, setSolicitudes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [mensaje, setMensaje] = useState('');
    const [errorCarga, setErrorCarga] = useState(false);
    const [disciplinas, setDisciplinas] = useState([]);
    const [disciplinaId, setDisciplinaId] = useState('');
    const [errorCatalogo, setErrorCatalogo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [resultado, setResultado] = useState(null);

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

    const actualizar = () => {
        cargarSolicitudes();
        setErrorCatalogo('');
        getDisciplinasActivas()
            .then(({ data }) => setDisciplinas(data.data || []))
            .catch(error => {
                setDisciplinas([]);
                setErrorCatalogo(error.response?.data?.message || 'No se pudo cargar el catálogo de disciplinas.');
            });
    };

    const enviarSolicitud = async (event) => {
        event.preventDefault();
        if (!disciplinaId || enviando) return;

        setEnviando(true);
        setResultado(null);
        try {
            await solicitarVinculacion(Number(disciplinaId));
            setDisciplinaId('');
            setResultado({ tipo: 'success', texto: 'Solicitud enviada. Queda pendiente de revisión.' });
            await cargarSolicitudes();
        } catch (error) {
            setResultado({
                tipo: 'error',
                texto: error.response?.data?.message || 'No se pudo enviar la solicitud.'
            });
        } finally {
            setEnviando(false);
        }
    };

    useEffect(() => {
        actualizar();
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
                        onClick={actualizar}
                        disabled={cargando || enviando}
                        className="sivec-button sivec-button-secondary"
                    >
                        Actualizar
                    </button>
                </div>

                <form className="sivec-card p-6 mb-6" onSubmit={enviarSolicitud}>
                    <h2 className="text-xl font-bold mb-4">Solicitar vinculación</h2>
                    <label className="block font-medium mb-2" htmlFor="disciplina-vinculacion">Disciplina</label>
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            id="disciplina-vinculacion"
                            className="rounded-lg border px-3 py-2"
                            value={disciplinaId}
                            onChange={event => setDisciplinaId(event.target.value)}
                            disabled={enviando || errorCarga || !disciplinas.length}
                            required
                        >
                            <option value="">Selecciona una disciplina</option>
                            {disciplinas.map(disciplina => (
                                <option key={disciplina.id_disciplina} value={disciplina.id_disciplina}>
                                    {disciplina.nombre}
                                </option>
                            ))}
                        </select>
                        <button
                            className="sivec-button sivec-button-primary"
                            disabled={cargando || enviando || errorCarga || !disciplinaId || !disciplinas.length}
                        >
                            {enviando ? 'Enviando…' : 'Enviar solicitud'}
                        </button>
                    </div>
                    {errorCatalogo && <p className="sivec-alert sivec-alert-error mt-4" role="alert">{errorCatalogo}</p>}
                    {resultado && (
                        <p className={`sivec-alert sivec-alert-${resultado.tipo} mt-4`} role="status">
                            {resultado.texto}
                        </p>
                    )}
                </form>

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
