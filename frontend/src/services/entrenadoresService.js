import api from './api'

export const buscarEntrenadores = (filtros) => api.get('/entrenadores', { params: filtros })
export const buscarDeportistas = (filtros) => api.get('/entrenadores/deportistas', { params: filtros })
export const misDeportistas = () => api.get('/entrenadores/mis-deportistas')
export const listarSolicitudesVinculacion = () => api.get('/entrenadores/solicitudes-vinculacion')
export const resolverSolicitudVinculacion = (id, estado) =>
  api.post(`/entrenadores/solicitudes-vinculacion/${id}/resolver`, { estado })
export const misSolicitudesVinculacion = () => api.get('/entrenadores/mis-solicitudes')
export const solicitarVinculacion = (id_disciplina) =>
  api.post('/entrenadores/solicitudes-vinculacion', { id_disciplina })
export const getAgenda = (filtros) => api.get('/disciplinas/cronograma', { params: filtros })

export const listarCronogramas = (filtros) => api.get('/cronogramas', { params: filtros })
export const crearCronograma = (datos) => api.post('/cronogramas', datos)
export const actualizarCronograma = (id, datos) => api.put(`/cronogramas/${id}`, datos)
export const bajaCronograma = (id) => api.delete(`/cronogramas/${id}`)
export const listarDisciplinasParaAgenda = () => api.get('/entrenadores/disciplinas-agenda')
