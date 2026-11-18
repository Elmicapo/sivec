import { useEffect, useState } from 'react';
import { actualizarDisciplina, buscarDisciplinas, crearDisciplina, darDeBaja } from '../services/disciplinasService';

const FORM_INICIAL = { nombre: '', categoria: 'DEPORTIVA', poblacion_objetivo: '', cupo_maximo: '' };

export default function AdminDisciplinas() {
    const [disciplinas, setDisciplinas] = useState(null);
    const [form, setForm] = useState(FORM_INICIAL);
    const [editando, setEditando] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [ocupado, setOcupado] = useState(false);
    const [mensaje, setMensaje] = useState(null);
    const [errorLista, setErrorLista] = useState('');

    const cargar = async () => {
        setCargando(true);
        setErrorLista('');
        try {
            const { data } = await buscarDisciplinas();
            setDisciplinas(data.data);
        } catch (error) {
            setErrorLista(error.response?.data?.message || 'No se pudieron cargar las disciplinas.');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        let activo = true;
        buscarDisciplinas()
            .then(({ data }) => { if (activo) setDisciplinas(data.data); })
            .catch(error => { if (activo) setErrorLista(error.response?.data?.message || 'No se pudieron cargar las disciplinas.'); })
            .finally(() => { if (activo) setCargando(false); });
        return () => { activo = false; };
    }, []);

    const cambiar = event => {
        const { name, value } = event.target;
        setForm(actual => ({ ...actual, [name]: value }));
    };

    const cancelar = () => {
        setEditando(null);
        setForm(FORM_INICIAL);
        setMensaje(null);
    };

    const editar = disciplina => {
        setEditando(disciplina.id_disciplina);
        setForm({
            nombre: disciplina.nombre,
            categoria: disciplina.categoria,
            poblacion_objetivo: disciplina.poblacion_objetivo ?? '',
            cupo_maximo: disciplina.cupo_maximo
        });
        setMensaje(null);
        document.getElementById('disciplina-nombre')?.focus();
    };

    const guardar = async event => {
        event.preventDefault();
        const datos = { ...form, nombre: form.nombre.trim(), poblacion_objetivo: form.poblacion_objetivo.trim(), cupo_maximo: Number(form.cupo_maximo) };
        if (!datos.nombre || !Number.isSafeInteger(datos.cupo_maximo) || datos.cupo_maximo < 1) {
            setMensaje({ tipo: 'error', texto: 'Escribe un nombre y un cupo entero mayor que cero.' });
            return;
        }

        setOcupado(true);
        setMensaje(null);
        try {
            const { data } = editando ? await actualizarDisciplina(editando, datos) : await crearDisciplina(datos);
            cancelar();
            setMensaje({ tipo: 'success', texto: data.message });
            await cargar();
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error.response?.data?.message || 'No se pudo guardar la disciplina.' });
        } finally {
            setOcupado(false);
        }
    };

    const desactivar = async disciplina => {
        if (!window.confirm(`¿Dar de baja ${disciplina.nombre} y desactivar sus cronogramas?`)) return;
        setOcupado(true);
        setMensaje(null);
        try {
            const { data } = await darDeBaja(disciplina.id_disciplina);
            if (editando === disciplina.id_disciplina) cancelar();
            setMensaje({ tipo: 'success', texto: data.message });
            await cargar();
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error.response?.data?.message || 'No se pudo dar de baja la disciplina.' });
        } finally {
            setOcupado(false);
        }
    };

    return (
        <main className="offer-page min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <header className="offer-page-heading mb-6">
                    <span className="block mb-2 text-sm font-semibold uppercase tracking-wide text-green-700">Administración de oferta</span>
                    <h1>Administrar disciplinas</h1>
                    <p>Crea disciplinas deportivas o culturales y gestiona su configuración.</p>
                </header>

                <section aria-labelledby="formulario-disciplina" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 id="formulario-disciplina" className="text-xl font-bold mb-6 text-gray-800 border-b pb-3">
                        {editando ? 'Editar disciplina' : 'Nueva disciplina'}
                    </h2>
                    <form onSubmit={guardar}>
                        <fieldset disabled={ocupado} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <label className="offer-field">Nombre
                                <input id="disciplina-nombre" name="nombre" value={form.nombre} onChange={cambiar} required />
                            </label>
                            <label className="offer-field">Categoría
                                <select name="categoria" value={form.categoria} onChange={cambiar} required>
                                    <option value="DEPORTIVA">Deportiva</option>
                                    <option value="CULTURAL">Cultural</option>
                                </select>
                            </label>
                            <label className="offer-field">Población
                                <input name="poblacion_objetivo" value={form.poblacion_objetivo} onChange={cambiar} />
                            </label>
                            <label className="offer-field">Cupo máximo
                                <input name="cupo_maximo" type="number" min="1" step="1" value={form.cupo_maximo} onChange={cambiar} required />
                            </label>
                        </fieldset>
                        {mensaje && <p className={`sivec-alert sivec-alert-${mensaje.tipo} mt-4`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>{mensaje.texto}</p>}
                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            {editando && <button type="button" className="offer-button offer-button-secondary" onClick={cancelar} disabled={ocupado}>Cancelar edición</button>}
                            <button className="offer-button offer-button-primary" disabled={ocupado}>
                                {editando ? 'Guardar cambios' : 'Crear disciplina'}
                            </button>
                        </div>
                    </form>
                </section>

                <section aria-labelledby="disciplinas-activas" className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <header className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                        <h2 id="disciplinas-activas" className="font-semibold">Disciplinas activas</h2>
                        <button type="button" className="offer-button offer-button-secondary" onClick={cargar} disabled={ocupado || cargando}>Actualizar</button>
                    </header>
                    {errorLista && <p role="alert" className="sivec-alert sivec-alert-error m-6">{errorLista}</p>}
                    {cargando && <p role="status" className="p-6">Cargando disciplinas…</p>}
                    {disciplinas && !errorLista && !cargando && (disciplinas.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase">
                                    <tr>{['Nombre', 'Categoría', 'Población', 'Cupos usados', 'Escenarios', 'Acciones'].map(titulo => (
                                        <th scope="col" key={titulo} className="px-6 py-3">{titulo}</th>
                                    ))}</tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-100">
                                    {disciplinas.map(disciplina => (
                                        <tr key={disciplina.id_disciplina}>
                                            <td className="px-6 py-4 font-semibold">{disciplina.nombre}</td>
                                            <td className="px-6 py-4">{disciplina.categoria === 'DEPORTIVA' ? 'Deportiva' : 'Cultural'}</td>
                                            <td className="px-6 py-4">{disciplina.poblacion_objetivo || '—'}</td>
                                            <td className="px-6 py-4">{disciplina.inscritos}/{disciplina.cupo_maximo}</td>
                                            <td className="px-6 py-4">{disciplina.escenarios || '—'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap space-x-3">
                                                <button type="button" onClick={() => editar(disciplina)} disabled={ocupado} className="offer-table-action">Editar</button>
                                                <button type="button" onClick={() => desactivar(disciplina)} disabled={ocupado} className="offer-table-action danger">Dar de baja</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="p-6 text-gray-600">No hay disciplinas activas.</p>)}
                </section>
            </div>
        </main>
    );
}
