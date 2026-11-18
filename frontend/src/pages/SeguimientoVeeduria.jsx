import { useState } from 'react';
import { consultarSeguimiento } from '../services/veeduriaService';

const ESTADOS = {
    PENDIENTE: 'Pendiente de revisión',
    VALIDADO: 'Validado por el CMJ',
    RECHAZADO: 'Rechazado por el CMJ'
};

export default function SeguimientoVeeduria() {
    const [codigo, setCodigo] = useState('');
    const [reporte, setReporte] = useState(null);
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const consultar = async event => {
        event.preventDefault();
        const valor = codigo.trim().toLowerCase();
        setReporte(null);
        if (!/^[a-f0-9]{64}$/.test(valor)) {
            setError('Ingresa el código de seguimiento de 64 caracteres.');
            return;
        }

        setError('');
        setCargando(true);
        try {
            const { data } = await consultarSeguimiento(valor);
            setReporte(data.data);
        } catch (fallo) {
            setError(fallo.response?.data?.message || 'No se pudo consultar el reporte. Intenta de nuevo.');
        } finally {
            setCargando(false);
        }
    };

    return (
        <main className="offer-page">
            <div className="offer-container offer-container-narrow">
                <header className="offer-page-heading">
                    <h1>Consultar reporte ciudadano</h1>
                    <p>Usa el código que recibiste al enviar tu reporte para conocer su estado.</p>
                </header>
                <form className="offer-filter-panel" onSubmit={consultar}>
                    <label className="offer-field">
                        Código de seguimiento
                        <input value={codigo} onChange={event => setCodigo(event.target.value)} required
                            autoComplete="off" spellCheck={false} disabled={cargando} />
                    </label>
                    <div className="offer-filter-actions">
                        <button className="offer-button offer-button-primary" disabled={cargando}>
                            {cargando ? 'Consultando…' : 'Consultar'}
                        </button>
                    </div>
                    {error && <p role="alert" className="offer-notice error">{error}</p>}
                </form>
                {reporte && (
                    <section aria-labelledby="resultado-seguimiento" className="offer-filter-panel space-y-3" aria-live="polite">
                        <h2 id="resultado-seguimiento" className="text-xl font-bold">{reporte.escenario}</h2>
                        <p><strong>Estado del reporte:</strong> {ESTADOS[reporte.estado_reporte] || reporte.estado_reporte}</p>
                        <p><strong>Estado propuesto:</strong> {reporte.estado_propuesto}</p>
                        <p><strong>Fecha de recepción:</strong> {reporte.fecha_recepcion}</p>
                        {reporte.fecha_oficializacion && <p><strong>Semáforo oficializado:</strong> {reporte.fecha_oficializacion}</p>}
                        {reporte.observacion_cmj && <p className="whitespace-pre-wrap"><strong>Observación del CMJ:</strong> {reporte.observacion_cmj}</p>}
                    </section>
                )}
            </div>
        </main>
    );
}
