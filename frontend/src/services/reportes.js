import { request } from './http';

export function getReports({ limit = 10, offset = 0, signal } = {}) {
  return request(`/rrhh/reportes?${new URLSearchParams({ limit, offset })}`, { signal });
}
export function getReport(fecha, signal) { return request(`/rrhh/reportes/${encodeURIComponent(fecha)}`, { signal }); }
export function generateTodayReport({ actualizar = false, signal } = {}) {
  return request('/rrhh/reportes/generar', { method: 'POST', body: { actualizar }, signal });
}
export function getMonthlyReports(signal) {
  return request('/rrhh/reportes-mensuales', { signal });
}
export function getMonthlyReport(mes, signal) {
  return request(`/rrhh/reportes-mensuales/${encodeURIComponent(mes)}`, { signal });
}
export function getCollaboratorProfile(id, { mes, signal } = {}) {
  const query = mes ? `?${new URLSearchParams({ mes })}` : '';
  return request(`/rrhh/colaboradores/${encodeURIComponent(id)}/ficha${query}`, { signal });
}
