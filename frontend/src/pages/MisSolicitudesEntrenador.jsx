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
                <header className="offer-page-heading mb-6">
                    <span className="block mb-2 text-sm font-semibold uppercase tracking-wide text-green-700">
                        Vinculación con disciplinas
                    </span>
                    <h1>Mis solicitudes de vinculación</h1>
                    <p>Solicita vincularte a una disciplina y consulta el estado de tus solicitudes.</p>
                </header>

                <section aria-labelledby="nueva-vinculacion" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 id="nueva-vinculacion" className="text-xl font-bold mb-6 text-gray-800 border-b pb-3">
                        Nueva solicitud
                    </h2>
                    <form onSubmit={enviarSolicitud} className="flex flex-col gap-5">
                        <div className="w-full md:w-1/2">
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="disciplina-vinculacion">
                                Disciplina
                            </label>
                            <select
                                id="disciplina-vinculacion"
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-sm p-2.5 border bg-white disabled:bg-gray-50 disabled:text-gray-500"
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
                        </div>

                        <div className="flex justify-end mt-2">
                            <button
                                type="submit"
                                className="w-full sm:w-auto bg-[#173F35] text-white px-6 py-2.5 rounded-md hover:bg-green-800 transition-colors text-sm font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                disabled={cargando || enviando || errorCarga || !disciplinaId || !disciplinas.length}
                            >
                                {enviando ? 'Enviando…' : 'Enviar solicitud'}
                            </button>
                        </div>

                        {errorCatalogo && <p className="sivec-alert sivec-alert-error" role="alert">{errorCatalogo}</p>}
                        {resultado && (
                            <p className={`sivec-alert sivec-alert-${resultado.tipo}`} role="status">
                                {resultado.texto}
                            </p>
                        )}
                    </form>
                </section>

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
