import api from './api'

export const buscarDisciplinas = (filtros) => api.get('/disciplinas', { params: filtros })
export const inscribirse = (id_disciplina) => api.post('/inscripciones', { id_disciplina })
export const miHistorial = () => api.get('/disciplinas/mi-historial')
export const crearDisciplina = (datos) => api.post('/disciplinas', datos)
export const actualizarDisciplina = (id, datos) => api.put(`/disciplinas/${id}`, datos)
export const darDeBaja = (id) => api.delete(`/disciplinas/${id}`)