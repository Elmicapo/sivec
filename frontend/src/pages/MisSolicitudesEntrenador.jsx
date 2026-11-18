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
        <div className="offer-page min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <header className="offer-page-heading">
                    <span className="block mb-2 text-sm font-semibold uppercase tracking-wide text-green-700">
                        Vinculación con disciplinas
                    </span>
                    <h1>Mis solicitudes de vinculación</h1>
                    <p>Solicita vincularte a una disciplina y consulta el estado de tus solicitudes.</p>
                </header>

                <form className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" onSubmit={enviarSolicitud}>
                    <h2 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-3 mb-5">
                        Solicitar vinculación
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <label className="offer-field" htmlFor="disciplina-vinculacion">
                            Disciplina
                            <select
                                id="disciplina-vinculacion"
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
                        </label>
                        <button
                            type="submit"
                            className="offer-button offer-button-primary"
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

                <section aria-labelledby="historial-vinculacion" className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <header className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                        <h2 id="historial-vinculacion" className="text-lg font-semibold text-gray-800">
                            Historial de solicitudes
                        </h2>
                        <button type="button" onClick={actualizar} disabled={cargando || enviando} className="offer-button offer-button-secondary">
                            Actualizar
                        </button>
                    </header>
                    {mensaje && (
                        <p className="sivec-alert sivec-alert-error m-6" role="alert">{mensaje}</p>
                    )}
                    {!errorCarga && (
                        cargando || solicitudes.length === 0 ? (
                            <p className="p-6 text-center text-sm text-gray-600" role="status">
                                {cargando ? 'Cargando solicitudes…' : 'Aún no tienes solicitudes de vinculación.'}
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table aria-labelledby="historial-vinculacion" className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 font-medium">Disciplina</th>
                                            <th scope="col" className="px-6 py-3 font-medium">Fecha de solicitud</th>
                                            <th scope="col" className="px-6 py-3 font-medium">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm divide-y divide-gray-100">
                                        {solicitudes.map(sol => (
                                            <tr key={sol.id_solicitud_vinculacion} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-semibold text-gray-900">{sol.disciplina}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{sol.fecha_solicitud}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`sivec-status sivec-status-${sol.estado === 'APROBADA' ? 'green' : sol.estado === 'RECHAZADA' ? 'red' : 'yellow'}`}>
                                                        {sol.estado || 'PENDIENTE'}
                                                    </span>
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

export default MisSolicitudesEntrenador;
