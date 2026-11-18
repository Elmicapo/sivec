import { useEffect, useState } from 'react';
import {
    getHistorico,
    getPendientes,
    getPendientesOficializacion,
    getSolicitudesEscenarioPendientes
} from '../services/veeduriaService';

function SeccionCMJ({ titulo, consultar, vacio, children }) {
    const [actualizacion, setActualizacion] = useState(0);
    const [consulta, setConsulta] = useState({ cargando: true });

    useEffect(() => {
        let activa = true;
        consultar()
            .then(({ data }) => {
                if (!Array.isArray(data?.data)) throw new Error('Respuesta de lista inválida.');
                if (activa) setConsulta({ filas: data.data });
            })
            .catch(error => {
                if (activa) setConsulta({ error: error.response?.data?.message || 'No se pudo cargar esta sección.' });
            });
        return () => { activa = false; };
    }, [consultar, actualizacion]);

    const actualizar = () => {
        setConsulta({ cargando: true });
        setActualizacion(valor => valor + 1);
    };

    return (
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" aria-busy={Boolean(consulta.cargando)}>
            <header className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-bold text-gray-800">{titulo}</h2>
                <button type="button" onClick={actualizar} disabled={consulta.cargando} className="offer-button offer-button-secondary" aria-label={`Actualizar: ${titulo}`}>
                    Actualizar
                </button>
            </header>
            {consulta.cargando && <p className="p-5 text-sm text-gray-600" role="status">Cargando…</p>}
            {consulta.error && <p className="sivec-alert sivec-alert-error m-5" role="alert">{consulta.error}</p>}
            {consulta.filas && (consulta.filas.length ? children(consulta.filas) : (
                <p className="p-5 text-sm text-gray-600">{vacio}</p>
            ))}
        </section>
    );
}

function ListaReportes({ reportes, oficializacion = false }) {
    return (
        <ul className="divide-y divide-gray-100">
            {reportes.map(reporte => (
                <li key={reporte.id_reporte} className="p-5 space-y-2 text-sm text-gray-700">
                    <h3 className="font-semibold text-gray-900">{reporte.escenario}</h3>
                    <p>Reporte #{reporte.id_reporte} · {reporte.fecha_reporte}</p>
                    <p>{oficializacion && `Estado actual: ${reporte.estado_actual} · `}Estado propuesto: {reporte.estado_propuesto}</p>
                    {reporte.descripcion && <p className="whitespace-pre-wrap wrap-break-word">{reporte.descripcion}</p>}
                </li>
            ))}
        </ul>
    );
}

export default function PanelCMJ() {
    return (
        <div className="offer-page min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <header className="offer-page-heading">
                    <h1>Veeduría de escenarios (CMJ)</h1>
                    <p>La validación y la oficialización del semáforo son operaciones independientes.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <SeccionCMJ titulo="Reportes pendientes" consultar={getPendientes} vacio="No hay reportes pendientes.">
                        {filas => <ListaReportes reportes={filas} />}
                    </SeccionCMJ>
                    <SeccionCMJ titulo="Pendientes de oficialización" consultar={getPendientesOficializacion} vacio="No hay reportes validados pendientes de oficialización.">
                        {filas => <ListaReportes reportes={filas} oficializacion />}
                    </SeccionCMJ>
                    <SeccionCMJ titulo="Propuestas de escenarios" consultar={getSolicitudesEscenarioPendientes} vacio="No hay propuestas pendientes.">
                        {filas => (
                            <ul className="divide-y divide-gray-100">
                                {filas.map(propuesta => (
                                    <li key={propuesta.id_solicitud_escenario} className="p-5 space-y-2 text-sm text-gray-700">
                                        <h3 className="font-semibold text-gray-900">{propuesta.nombre_escenario}</h3>
                                        <p>{[propuesta.disciplina, propuesta.tipo_escenario].filter(Boolean).join(' · ')}</p>
                                        <p>{[propuesta.comuna, propuesta.barrio, propuesta.corregimiento, propuesta.localidad_rural].filter(Boolean).join(' · ')}</p>
                                        <p>Propuesta #{propuesta.id_solicitud_escenario} · {propuesta.fecha_solicitud}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SeccionCMJ>
                </div>

                <SeccionCMJ titulo="Histórico de veedurías" consultar={getHistorico} vacio="Todavía no hay reportes en el histórico.">
                    {filas => (
                        <div className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2" role="region" aria-label="Tabla del histórico de veedurías" tabIndex={0}>
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        {['Escenario', 'Reportante', 'Estado propuesto', 'Estado', 'Validó', 'Fecha del reporte', 'Observación'].map(columna => (
                                            <th key={columna} scope="col" className="px-5 py-3 font-medium whitespace-nowrap">{columna}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-100">
                                    {filas.map(reporte => (
                                        <tr key={reporte.id_reporte} className="hover:bg-gray-50">
                                            <td className="px-5 py-4 font-semibold">{reporte.escenario}</td>
                                            <td className="px-5 py-4">{reporte.reportante || '—'}</td>
                                            <td className="px-5 py-4">{reporte.estado_propuesto}</td>
                                            <td className="px-5 py-4">{reporte.estado_reporte}</td>
                                            <td className="px-5 py-4">{reporte.validado_por || '—'}</td>
                                            <td className="px-5 py-4 whitespace-nowrap">{reporte.fecha_reporte}</td>
                                            <td className="px-5 py-4">{reporte.observacion_cmj || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SeccionCMJ>
            </div>
        </div>
    );
}
