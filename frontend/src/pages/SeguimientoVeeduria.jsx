import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ConsultarReporte = () => {
    const [codigo, setCodigo] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (codigo.trim()) {
            // Lógica para enviar o redirigir con el código
            // navigate(`/seguimiento/${codigo}`);
            console.log('Consultando código:', codigo);
        }
    };

    return (
        <div className="offer-page min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            {/* Se utiliza sivec-card y max-w-2xl para centrar y dimensionar la tarjeta */}
            <div className="sivec-card max-w-2xl w-full p-8 md:p-12 text-center">
                
                {/* Kicker institucional con color secundario */}
                <span className="offer-eyebrow mb-3 block" style={{ color: 'var(--color-secondary)' }}>
                    SIVEC / PARTICIPACIÓN CIUDADANA
                </span>
                
                {/* Título y descripción con colores estandarizados */}
                <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
                    Consultar reporte ciudadano
                </h1>
                <p className="mb-8 text-base md:text-lg" style={{ color: 'var(--color-text-secondary)' }}>
                    Consulta el avance de tu reporte con el código de seguimiento que recibiste.
                </p>

                {/* Formulario alineado horizontalmente con clases estandarizadas */}
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
                    <input 
                        type="text" 
                        placeholder="Código de 64 caracteres" 
                        className="sivec-input flex-1"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                        required
                    />
                    <button type="submit" className="sivec-button sivec-button-primary whitespace-nowrap">
                        Consultar
                    </button>
                </form>
                
            </div>
        </div>
    );
};

export default ConsultarReporte;