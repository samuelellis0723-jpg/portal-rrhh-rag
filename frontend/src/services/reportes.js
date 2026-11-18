import { request } from './http';

export function getReports({ limit = 10, offset = 0, signal } = {}) {
  return request(`/rrhh/reportes?${new URLSearchParams({ limit, offset })}`, { signal });
}
export function getReport(fecha, signal) { return request(`/rrhh/reportes/${encodeURIComponent(fecha)}`, { signal }); }
