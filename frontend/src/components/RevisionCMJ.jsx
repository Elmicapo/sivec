import { useEffect, useRef, useState } from 'react';
import {
    getDetalleReporte,
    getEvidenciaReporte,
    oficializarReporte,
    resolverReporte,
    resolverSolicitudEscenario
} from '../services/veeduriaService';

function Evidencia({ idReporte, orden }) {
    const [imagen, setImagen] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        let activa = true;
        let url;
        getEvidenciaReporte(idReporte, orden)
            .then(({ data }) => {
                if (!activa) return;
                url = URL.createObjectURL(data);
                setImagen(url);
            })
            .catch(() => {
                if (activa) setError('No se pudo cargar la fotografía.');
            })
            .finally(() => {
                if (activa) setCargando(false);
            });
        return () => {
            activa = false;
            if (url) URL.revokeObjectURL(url);
        };
    }, [idReporte, orden]);

    return (
        <figure>
            {cargando && <p role="status">Cargando fotografía {orden}…</p>}
            {error && <p role="alert">{error} (evidencia {orden})</p>}
            {imagen && <a href={imagen} target="_blank" rel="noreferrer">
                <img src={imagen} alt={`Evidencia fotográfica ${orden}`} className="max-h-64 rounded-lg border border-gray-200 object-contain" />
            </a>}
        </figure>
    );
}

export default function RevisionCMJ({ tipo, item, cerrar, finalizar }) {
    const dialogo = useRef(null);
    const [detalle, setDetalle] = useState(null);
    const [errorDetalle, setErrorDetalle] = useState('');
    const [observacion, setObservacion] = useState('');
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);
    const propuesta = tipo === 'propuesta';
    const oficializacion = tipo === 'oficializacion';
    const titulo = propuesta ? 'Revisar propuesta de escenario' : oficializacion ? 'Oficializar semáforo' : 'Revisar reporte de veeduría';

    useEffect(() => {
        const elemento = dialogo.current;
        elemento.showModal();
        return () => elemento.close();
    }, []);

    useEffect(() => {
        if (propuesta) return;
        let activa = true;
        getDetalleReporte(item.id_reporte)
            .then(({ data }) => {
                if (activa) setDetalle(data.data);
            })
            .catch(fallo => {
                if (activa) setErrorDetalle(fallo.response?.data?.message || 'No se pudo cargar el detalle del reporte.');
            });
        return () => { activa = false; };
    }, [propuesta, item.id_reporte]);

    const decidir = async decision => {
        if (guardando) return;
        const nota = observacion.trim();
        if (decision === 'rechazar' && !nota) {
            setError('Escribe el motivo del rechazo.');
            return;
        }

        setGuardando(true);
        setError('');
        try {
            if (propuesta) {
                await resolverSolicitudEscenario(item.id_solicitud_escenario, {
                    estado_revision: decision === 'rechazar' ? 'RECHAZADA' : 'APROBADA',
                    observacion_cmj: nota
                });
                finalizar(decision === 'rechazar' ? 'Propuesta rechazada.' : 'Propuesta aprobada. El escenario quedó registrado.');
            } else if (oficializacion) {
                await oficializarReporte(item.id_reporte);
                finalizar('Semáforo oficial actualizado.');
            } else {
                await resolverReporte(item.id_reporte, {
                    estado_reporte: decision === 'rechazar' ? 'RECHAZADO' : 'VALIDADO',
                    observacion_cmj: nota
                });
                finalizar(decision === 'rechazar' ? 'Reporte rechazado.' : 'Reporte validado. Ya está disponible para oficialización.');
            }
        } catch (fallo) {
            setError(fallo.response?.data?.message || 'No se pudo registrar la decisión.');
            setGuardando(false);
        }
    };

    return (
        <dialog ref={dialogo} aria-labelledby="titulo-revision-cmj" className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl backdrop:bg-black/50"
            onCancel={event => { event.preventDefault(); if (!guardando) cerrar(); }}>
            <header className="mb-4 border-b border-gray-200 pb-3">
                <h2 id="titulo-revision-cmj" className="text-xl font-bold text-[#173F35]">{titulo}</h2>
                <p className="mt-1 font-medium">{propuesta ? item.nombre_escenario : item.escenario}</p>
            </header>

            {propuesta ? (
                <dl className="space-y-2 text-sm">
                    <div><dt className="inline font-semibold">Disciplina: </dt><dd className="inline">{item.disciplina}</dd></div>
                    <div><dt className="inline font-semibold">Tipo de escenario: </dt><dd className="inline">{item.tipo_escenario || 'Sin especificar'}</dd></div>
                    <div><dt className="inline font-semibold">Ubicación: </dt><dd className="inline">{[item.comuna, item.barrio, item.corregimiento, item.localidad_rural].filter(Boolean).join(' · ') || '—'}</dd></div>
                    {item.latitud != null && item.longitud != null && <div><dt className="inline font-semibold">Coordenadas: </dt><dd className="inline">{item.latitud}, {item.longitud}</dd></div>}
                </dl>
            ) : (
                <div className="space-y-3 text-sm">
                    {errorDetalle && <p className="sivec-alert sivec-alert-error" role="alert">{errorDetalle}</p>}
                    {!detalle && !errorDetalle && <p role="status">Cargando detalle…</p>}
                    <p><strong>Estado propuesto:</strong> {item.estado_propuesto}</p>
                    {oficializacion && <p className="sivec-alert sivec-alert-info">
                        Al confirmar, el semáforo pasará de <strong>{item.estado_actual}</strong> a <strong>{item.estado_propuesto}</strong>.
                    </p>}
                    {detalle && <>
                        <p className="whitespace-pre-wrap wrap-break-word">{detalle.descripcion}</p>
                        {detalle.observacion_cmj && <p><strong>Observación registrada:</strong> {detalle.observacion_cmj}</p>}
                        {detalle.evidencias?.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-semibold">Evidencias</h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {detalle.evidencias.map(({ orden }) => <Evidencia key={orden} idReporte={item.id_reporte} orden={orden} />)}
                                </div>
                            </div>
                        )}
                    </>}
                </div>
            )}

            {!oficializacion && (
                <label className="mt-5 block text-sm font-medium">
                    Observación del CMJ <span className="font-normal text-gray-600">(obligatoria para rechazar)</span>
                    <textarea value={observacion} onChange={event => setObservacion(event.target.value)} disabled={guardando} rows={3}
                        className="mt-2 w-full rounded-md border border-gray-300 p-3" />
                </label>
            )}
            {error && <p className="sivec-alert sivec-alert-error mt-4" role="alert">{error}</p>}
            {guardando && <p className="mt-4 text-sm" role="status">Guardando decisión…</p>}

            <footer className="mt-6 flex flex-wrap justify-end gap-2 border-t border-gray-200 pt-4">
                <button type="button" className="offer-button offer-button-secondary" onClick={cerrar} disabled={guardando}>Cancelar</button>
                {!oficializacion && <button type="button" className="sivec-button sivec-button-danger" onClick={() => decidir('rechazar')} disabled={guardando || (!propuesta && !detalle)}>Rechazar</button>}
                <button type="button" className="offer-button offer-button-primary" onClick={() => decidir('aceptar')} disabled={guardando || (propuesta ? !item.tipo_escenario : !detalle)}>
                    {propuesta ? 'Aprobar propuesta' : oficializacion ? 'Confirmar oficialización' : 'Validar reporte'}
                </button>
            </footer>
        </dialog>
    );
}
