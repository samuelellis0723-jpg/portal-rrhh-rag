const ApiError = require('../services/api-error');
const repository = require('../repositories/report-repository');

function pagination(query) {
  const parse = (name, fallback, max) => {
    if (query[name] === undefined) return fallback;
    const raw = query[name];
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new ApiError(400, 'VALIDATION_ERROR', 'Parámetros de paginación inválidos.');
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || (name === 'limit' ? value < 1 : value < 0) || value > max) throw new ApiError(400, 'VALIDATION_ERROR', 'Parámetros de paginación inválidos.');
    return value;
  };
  const limit = parse('limit', 20, 100);
  const offset = parse('offset', 0, Number.MAX_SAFE_INTEGER);
  return { limit, offset };
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateString(value) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }

function createReportController(store = repository) {
  return {
    async list(req, res) {
      const page = req.pagination || pagination(req.query);
      const result = await store.list(page);
      res.json({ data: { items: result.rows.map((row) => ({
        id: Number(row.id), fecha: dateString(row.fecha), origen: row.origen,
        esquema_version: Number(row.esquema_version), generado_por: row.generado_por,
        generado_en: new Date(row.generado_en).toISOString(), resumen_texto: row.resumen_texto,
      })), limit: page.limit, offset: page.offset, total: Number(result.count) } });
    },
    async getByDate(req, res) {
      if (!validDate(req.params.fecha)) throw new ApiError(400, 'VALIDATION_ERROR', 'La fecha debe tener formato YYYY-MM-DD válido.');
      const row = await store.findByDate(req.params.fecha);
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'No hay un reporte disponible para esa fecha.');
      const data = typeof row.datos_json === 'string' ? JSON.parse(row.datos_json) : row.datos_json;
      res.json({ data: {
        id: Number(row.id), fecha: dateString(row.fecha), generado_en: new Date(row.generado_en).toISOString(),
        generado_por: row.generado_por, origen: row.origen, esquema_version: Number(row.esquema_version),
        datos: data, resumen_texto: row.resumen_texto,
      } });
    },
  };
}

const controller = createReportController();
module.exports = { ...controller, createReportController, pagination, validDate };
