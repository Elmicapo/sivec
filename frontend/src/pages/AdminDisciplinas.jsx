import { useEffect, useRef, useState } from 'react';
import { actualizarDisciplina, listarDisciplinasAdministracion, crearDisciplina, darDeBaja, reactivarDisciplina } from '../services/disciplinasService';
import { getEscenarios } from '../services/veeduriaService';
import useActualizarLista from '../hooks/useActualizarLista';
import { avisarCambioDisciplinas } from '../services/actualizacionDisciplinas';

const FORM_INICIAL = { nombre: '', categoria: 'DEPORTIVA', poblacion_objetivo: '', cupo_maximo: '', ids_escenarios: [] };

export default function AdminDisciplinas() {
    const [disciplinas, setDisciplinas] = useState(null);
    const [escenarios, setEscenarios] = useState(null);
    const [errorEscenarios, setErrorEscenarios] = useState('');
    const [form, setForm] = useState(FORM_INICIAL);
    const [editando, setEditando] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [ocupado, setOcupado] = useState(false);
    const [mensaje, setMensaje] = useState(null);
    const [errorLista, setErrorLista] = useState('');

    const [cambioPendiente, setCambioPendiente] = useState(null);
    const dialogoEstado = useRef(null);
    const consulta = useRef(0);

    useEffect(() => {
        if (!cambioPendiente) return;
        const dialogo = dialogoEstado.current;
        dialogo.showModal();
        return () => dialogo.close();
    }, [cambioPendiente]);

    const cargar = async (silenciosa = false) => {
        const turno = ++consulta.current;
        if (!silenciosa) {
            setCargando(true);
            setErrorLista('');
        }
        try {
            const { data } = await listarDisciplinasAdministracion();
            if (turno !== consulta.current) return;
            setDisciplinas(data.data);
            setErrorLista('');
        } catch (error) {
            if (silenciosa || turno !== consulta.current) return;
            setErrorLista(error.response?.data?.message || 'No se pudieron cargar las disciplinas.');
        } finally {
            if (!silenciosa && turno === consulta.current) setCargando(false);
        }
    };

    useActualizarLista(() => {
        if (!ocupado && !cargando) return cargar(true);
    }, true);

    useEffect(() => {
        let activo = true;
        listarDisciplinasAdministracion()
            .then(({ data }) => { if (activo) setDisciplinas(data.data); })
            .catch(error => { if (activo) setErrorLista(error.response?.data?.message || 'No se pudieron cargar las disciplinas.'); })
            .finally(() => { if (activo) setCargando(false); });
        getEscenarios()
            .then(({ data }) => { if (activo) setEscenarios(data.data); })
            .catch(() => { if (activo) setErrorEscenarios('No se pudo cargar el catálogo de escenarios.'); });
        return () => { activo = false; };
    }, []);

    const actualizarDatos = async () => {
        await Promise.all([
            cargar(),
            getEscenarios()
                .then(({ data }) => {
                    setEscenarios(data.data);
                    setErrorEscenarios('');
                })
                .catch(() => setErrorEscenarios('No se pudo cargar el catálogo de escenarios.'))
        ]);
    };

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
            cupo_maximo: disciplina.cupo_maximo,
            ids_escenarios: (disciplina.ids_escenarios || []).map(Number)
        });
        setMensaje(null);
        document.getElementById('disciplina-nombre')?.focus();
    };

    const guardar = async event => {
        event.preventDefault();
        const datos = { ...form, nombre: form.nombre.trim(), poblacion_objetivo: form.poblacion_objetivo.trim(), cupo_maximo: Number(form.cupo_maximo) };
        if (!escenarios) delete datos.ids_escenarios;
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
            avisarCambioDisciplinas();
            await cargar();
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error.response?.data?.message || 'No se pudo guardar la disciplina.' });
        } finally {
            setOcupado(false);
        }
    };

    const cambiarEstado = async disciplina => {
        const activar = disciplina.estado === 'INACTIVA';
        const mostrarEstado = estado => setDisciplinas(actuales => actuales.map(fila =>
            fila.id_disciplina === disciplina.id_disciplina ? { ...fila, estado } : fila
        ));
        consulta.current += 1;
        setOcupado(true);
        setMensaje(null);
        mostrarEstado(activar ? 'ACTIVA' : 'INACTIVA');
        try {
            const operacion = activar ? reactivarDisciplina : darDeBaja;
            const { data } = await operacion(disciplina.id_disciplina);
            avisarCambioDisciplinas();
            if (editando === disciplina.id_disciplina) cancelar();
            setMensaje({ tipo: 'success', texto: data.message, enLista: true });
        } catch (error) {
            mostrarEstado(disciplina.estado);
            setMensaje({ tipo: 'error', texto: error.response?.data?.message || 'No se pudo cambiar el estado de la disciplina.', enLista: true });
        } finally {
            setOcupado(false);
        }
    };

    const accionesDisciplina = disciplina => (
        <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => editar(disciplina)} disabled={ocupado} className="offer-table-action">Editar</button>
            <button type="button" onClick={() => setCambioPendiente(disciplina)} disabled={ocupado || cargando}
                className={`offer-table-action min-h-11 ${disciplina.estado === 'INACTIVA' ? '' : 'danger'}`}>
                {disciplina.estado === 'INACTIVA' ? 'Reactivar' : 'Dar de baja'}
            </button>
        </div>
    );

    const reactivacionPendiente = cambioPendiente?.estado === 'INACTIVA';
    const confirmarCambio = () => {
        const disciplina = cambioPendiente;
        setCambioPendiente(null);
        void cambiarEstado(disciplina);
    };

    return (
        <main className="offer-page min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <header className="offer-page-heading mb-6">
                    <span className="block mb-2 text-sm font-semibold uppercase tracking-wide text-green-700">Administración de oferta</span>
                    <h1>Administrar disciplinas</h1>
                    <p>Crea disciplinas deportivas o culturales y gestiona su configuración.</p>
                    <button type="button" className="offer-button offer-button-secondary mt-4 w-full sm:w-auto"
                        onClick={actualizarDatos} disabled={ocupado || cargando}>
                        {cargando ? 'Actualizando datos…' : 'Actualizar datos'}
                    </button>
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
                        <fieldset disabled={ocupado} className="mt-5 space-y-2">
                            <legend className="font-semibold">Vincular escenarios deportivos o culturales</legend>
                            {errorEscenarios && <p role="alert">{errorEscenarios}</p>}
                            {!escenarios && !errorEscenarios && <p role="status">Cargando escenarios…</p>}
                            {escenarios?.length === 0 && <p>No hay escenarios disponibles.</p>}
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {escenarios?.map(escenario => {
                                    const id = Number(escenario.id_escenario);
                                    return (
                                        <label key={id} className="flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 px-3">
                                            <input type="checkbox" checked={form.ids_escenarios.includes(id)}
                                                onChange={event => {
                                                    const seleccionado = event.target.checked;
                                                    setForm(actual => ({
                                                        ...actual,
                                                        ids_escenarios: seleccionado
                                                            ? [...actual.ids_escenarios, id]
                                                            : actual.ids_escenarios.filter(valor => valor !== id)
                                                    }));
                                                }} />
                                            {escenario.nombre}
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                        {mensaje && !mensaje.enLista && <p className={`sivec-alert sivec-alert-${mensaje.tipo} mt-4`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>{mensaje.texto}</p>}
                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            {editando && <button type="button" className="offer-button offer-button-secondary" onClick={cancelar} disabled={ocupado}>Cancelar edición</button>}
                            <button className="offer-button offer-button-primary" disabled={ocupado}>
                                {editando ? 'Guardar cambios' : 'Crear disciplina'}
                            </button>
                        </div>
                    </form>
                </section>

                <section aria-labelledby="lista-disciplinas" className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <header className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                        <h2 id="lista-disciplinas" className="font-semibold">Disciplinas registradas</h2>
                    </header>
                    {mensaje?.enLista && <p className={`sivec-alert sivec-alert-${mensaje.tipo} m-4`}
                        role={mensaje.tipo === 'error' ? 'alert' : 'status'}>{mensaje.texto}</p>}
                    {errorLista && <p role="alert" className="sivec-alert sivec-alert-error m-6">{errorLista}</p>}
                    {cargando && <p role="status" className="p-6">Cargando disciplinas…</p>}
                    {disciplinas && !cargando && (disciplinas.length ? (
                        <>
                            <ul className="divide-y divide-gray-100 xl:hidden">
                                {disciplinas.map(disciplina => (
                                    <li key={disciplina.id_disciplina} className="space-y-3 p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <h3 className="font-semibold">{disciplina.nombre}</h3>
                                            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium">
                                                {disciplina.estado === 'INACTIVA' ? 'Dada de baja' : 'Activa'}
                                            </span>
                                        </div>
                                        <dl className="grid grid-cols-2 gap-2 text-sm">
                                            <div><dt className="font-medium">Categoría</dt><dd>{disciplina.categoria === 'DEPORTIVA' ? 'Deportiva' : 'Cultural'}</dd></div>
                                            <div><dt className="font-medium">Cupos usados</dt><dd>{disciplina.inscritos}/{disciplina.cupo_maximo}</dd></div>
                                            <div><dt className="font-medium">Población</dt><dd>{disciplina.poblacion_objetivo || '—'}</dd></div>
                                            <div><dt className="font-medium">Escenarios</dt><dd>{disciplina.escenarios || '—'}</dd></div>
                                        </dl>
                                        {accionesDisciplina(disciplina)}
                                    </li>
                                ))}
                            </ul>
                            <div className="hidden overflow-x-auto xl:block">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase">
                                        <tr>{['Nombre', 'Categoría', 'Población', 'Cupos usados', 'Escenarios', 'Estado', 'Acciones'].map(titulo => (
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
                                                <td className="px-6 py-4">{disciplina.estado === 'INACTIVA' ? 'Dada de baja' : 'Activa'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap space-x-3">
                                                    {accionesDisciplina(disciplina)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : <p className="p-6 text-gray-600">No hay disciplinas registradas.</p>)}
                </section>
            </div>
            {cambioPendiente && (
                <dialog ref={dialogoEstado} aria-labelledby="titulo-cambio-disciplina" aria-describedby="aviso-cambio-disciplina"
                    onCancel={() => setCambioPendiente(null)}
                    className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl backdrop:bg-black/50">
                    <h2 id="titulo-cambio-disciplina" className="text-xl font-bold">
                        {reactivacionPendiente ? 'Reactivar disciplina' : 'Dar de baja disciplina'}
                    </h2>
                    <p id="aviso-cambio-disciplina" className="mt-3">
                        {reactivacionPendiente
                            ? `${cambioPendiente.nombre} está dada de baja. ¿Quieres reactivarla? Sus cronogramas se gestionan por separado.`
                            : `¿Dar de baja ${cambioPendiente.nombre} y desactivar sus cronogramas?`}
                    </p>
                    <form className="mt-6 grid grid-cols-2 gap-3" onSubmit={event => { event.preventDefault(); confirmarCambio(); }}>
                        <button type="button" autoFocus className="offer-button offer-button-secondary"
                            onClick={() => setCambioPendiente(null)}>Cancelar</button>
                        <button type="submit" className="offer-button offer-button-primary min-h-11">
                            {reactivacionPendiente ? 'Reactivar' : 'Dar de baja'}
                        </button>
                    </form>
                </dialog>
            )}
        </main>
    );
}
