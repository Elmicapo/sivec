import React, { useState } from 'react';
import { crearCronograma } from '../services/api';

const FormularioCronograma = ({ onSuccess }) => {
    const [formData, setFormData] = useState({
        id_disciplina: '',
        id_escenario: '',
        id_entrenador: '',
        dia_semana: 'LUNES',
        hora_inicio: '',
        hora_fin: '',
        vigencia_desde: ''
    });
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMensaje({ tipo: 'info', texto: 'Guardando...' });
        
        try {
            const respuesta = await crearCronograma(formData);
            if (respuesta.data.success) {
                setMensaje({ tipo: 'success', texto: respuesta.data.message });
                // Limpiar el formulario tras el éxito
                setFormData({
                    id_disciplina: '', id_escenario: '', id_entrenador: '',
                    dia_semana: 'LUNES', hora_inicio: '', hora_fin: '', vigencia_desde: ''
                });
                onSuccess(); // Recarga la tabla
            } else {
                setMensaje({ tipo: 'error', texto: respuesta.data.message });
            }
        } catch (error) {
            setMensaje({ tipo: 'error', texto: 'Error de conexión.' });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-primary)' }}>
                Asignar Nuevo Horario
            </h3>
            
            {mensaje.texto && (
                <div className={`sivec-alert sivec-alert-${mensaje.tipo}`} role="status">
                    {mensaje.texto}
                </div>
            )}
            
            <div>
                <label className="sivec-label" htmlFor="id_disciplina">ID Disciplina</label>
                <input className="sivec-input w-full" type="number" id="id_disciplina" name="id_disciplina" value={formData.id_disciplina} required onChange={handleChange} />
            </div>

            <div>
                <label className="sivec-label" htmlFor="id_escenario">ID Escenario</label>
                <input className="sivec-input w-full" type="number" id="id_escenario" name="id_escenario" value={formData.id_escenario} required onChange={handleChange} />
            </div>

            <div>
                <label className="sivec-label" htmlFor="id_entrenador">ID Entrenador</label>
                <input className="sivec-input w-full" type="number" id="id_entrenador" name="id_entrenador" value={formData.id_entrenador} required onChange={handleChange} />
            </div>
            
            <div>
                <label className="sivec-label" htmlFor="dia_semana">Día de la semana</label>
                <select className="sivec-select w-full" id="dia_semana" name="dia_semana" value={formData.dia_semana} required onChange={handleChange}>
                    <option value="LUNES">Lunes</option>
                    <option value="MARTES">Martes</option>
                    <option value="MIERCOLES">Miércoles</option>
                    <option value="JUEVES">Jueves</option>
                    <option value="VIERNES">Viernes</option>
                    <option value="SABADO">Sábado</option>
                    <option value="DOMINGO">Domingo</option>
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="sivec-label" htmlFor="hora_inicio">Hora Inicio</label>
                    <input className="sivec-input w-full" type="time" id="hora_inicio" name="hora_inicio" value={formData.hora_inicio} required onChange={handleChange} />
                </div>
                <div>
                    <label className="sivec-label" htmlFor="hora_fin">Hora Fin</label>
                    <input className="sivec-input w-full" type="time" id="hora_fin" name="hora_fin" value={formData.hora_fin} required onChange={handleChange} />
                </div>
            </div>

            <div>
                <label className="sivec-label" htmlFor="vigencia_desde">Vigencia Desde</label>
                <input className="sivec-input w-full" type="date" id="vigencia_desde" name="vigencia_desde" value={formData.vigencia_desde} required onChange={handleChange} />
            </div>
            
            <button className="sivec-btn-primary w-full mt-4" type="submit">
                Guardar Cronograma
            </button>
        </form>
    );
};

export default FormularioCronograma;