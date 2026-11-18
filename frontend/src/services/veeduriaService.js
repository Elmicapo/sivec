import api from './api'

export const getEscenarios = () => api.get('/escenarios')
export const crearReporte = (datos) => api.post('/escenarios/reportes', datos)
export const crearSolicitudEscenario = (datos) => api.post('/escenarios/solicitudes', datos)
export const consultarSeguimiento = (codigo) => api.get(`/escenarios/reportes/seguimiento/${codigo}`)
export const getHistorialEscenario = (id) => api.get(`/escenarios/reportes/escenario/${id}/historico`)
export const getPendientes = () => api.get('/escenarios/reportes/pendientes')
export const getPendientesOficializacion = () => api.get('/escenarios/reportes/validados-pendientes-oficializacion')
export const getDetalleReporte = (id) => api.get(`/escenarios/reportes/${id}`)
export const getEvidenciaReporte = (id, orden) =>
  api.get(`/escenarios/reportes/${id}/evidencias/${orden}`, { responseType: 'blob' })
export const resolverReporte = (id, datos) => api.put(`/escenarios/reportes/${id}/validar`, datos)
export const oficializarReporte = (id) => api.post(`/escenarios/reportes/${id}/oficializar`)
export const getSolicitudesEscenarioPendientes = () => api.get('/escenarios/solicitudes/pendientes')
export const resolverSolicitudEscenario = (id, datos) => api.put(`/escenarios/solicitudes/${id}/resolver`, datos)
export const getHistorico = () => api.get('/reportes/historico-veedurias')
