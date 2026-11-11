import { pool } from '../db.js'; // Ajusta según la conexión de tu base de datos

// 1. Obtener los horarios de la agenda de un entrenador
export const obtenerAgendaEntrenador = async (req, res) => {
    try {
        const id_entrenador = req.user.id; // O según el payload de tu token/sesión

        const [rows] = await pool.query(
            `SELECT a.id_agenda AS id, a.dia, a.hora_inicio, a.hora_fin, 
                    d.nombre AS disciplina, e.nombre AS escenario, a.vigencia
             FROM agenda a
             JOIN deporte_escenario de ON a.id_deporte_escenario = de.id_deporte_escenario
             JOIN disciplina d ON de.id_disciplina = d.id_disciplina
             JOIN escenario e ON de.id_escenario = e.id_escenario
             WHERE a.id_entrenador = ?`,
            [id_entrenador]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error al obtener la agenda:', error);
        res.status(500).json({ message: 'Error interno al consultar la agenda' });
    }
};

// 2. Crear un nuevo registro en la agenda
export const crearHorarioAgenda = async (req, res) => {
    const { dia, hora_inicio, hora_fin, id_deporte_escenario, vigencia } = req.body;
    const id_entrenador = req.user.id;

    try {
        const [result] = await pool.query(
            `INSERT INTO agenda (dia, hora_inicio, hora_fin, id_deporte_escenario, id_entrenador, vigencia) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [dia, hora_inicio, hora_fin, id_deporte_escenario, id_entrenador, vigencia || null]
        );

        res.status(201).json({ id: result.insertId, message: 'Horario agregado correctamente' });
    } catch (error) {
        console.error('Error al crear horario:', error);
        res.status(500).json({ message: 'No se pudo guardar el nuevo horario en la agenda' });
    }
};

// 3. Eliminar un registro de la agenda
export const eliminarHorarioAgenda = async (req, res) => {
    const { id } = req.params;
    const id_entrenador = req.user.id;

    try {
        const [result] = await pool.query(
            `DELETE FROM agenda WHERE id_agenda = ? AND id_entrenador = ?`,
            [id, id_entrenador]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Horario no encontrado o no autorizado' });
        }

        res.json({ message: 'Horario eliminado con éxito' });
    } catch (error) {
        console.error('Error al eliminar horario:', error);
        res.status(500).json({ message: 'Error al eliminar el horario' });
    }
};