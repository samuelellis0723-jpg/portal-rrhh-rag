const { BaseError } = require('sequelize');
const ApiError = require('../services/api-error');
const repository = require('../repositories/report-repository');
const monthlyRepository = require('../repositories/monthly-report-repository');
const { generateDailyReport } = require('../services/report-service');
const { businessDate } = require('../jobs/report-scheduler');

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

function serializeDetail(row) {
  const data = typeof row.datos_json === 'string' ? JSON.parse(row.datos_json) : row.datos_json;
  return {
    id: Number(row.id), fecha: dateString(row.fecha), generado_en: new Date(row.generado_en).toISOString(),
    generado_por: row.generado_por, origen: row.origen, esquema_version: Number(row.esquema_version),
    datos: data, resumen_texto: row.resumen_texto,
  };
}

function createReportController(store = repository, {
  generateReport = generateDailyReport, todayDate = businessDate, monthlyStore = monthlyRepository,
} = {}) {
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
      res.json({ data: serializeDetail(row) });
    },
    async generate(req, res) {
      const update = req.body?.actualizar === true;
      let result;
      try {
        result = await generateReport(todayDate(), { store, update });
      } catch (error) {
        if (error instanceof ApiError || error instanceof BaseError) throw error;
        throw new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'No se pudo generar el reporte de hoy en este momento.');
      }
      if (result.status === 'busy') {
        throw new ApiError(409, 'REPORT_GENERATION_IN_PROGRESS', 'Ya hay una generación en curso para hoy. Inténtalo en unos segundos.');
      }
      res.status(result.status === 'created' ? 201 : 200).json({
        data: { ...serializeDetail(result.report), estado_generacion: result.status },
      });
    },
    async listMonthly(_req, res) {
      res.json({ data: { items: monthlyStore.listAvailableMonths(), mes_por_defecto: monthlyStore.DEFAULT_MONTH } });
    },
    async getMonthly(req, res) {
      const mes = req.params.mes;
      if (typeof mes !== 'string' || !/^\d{4}-\d{2}$/.test(mes)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'El mes debe tener formato YYYY-MM válido.');
      }
      const report = await monthlyStore.getMonthlyReport(mes);
      if (!report) throw new ApiError(404, 'NOT_FOUND', 'No hay un reporte mensual disponible para ese período.');
      res.json({ data: report });
    },
    async getCollaboratorProfile(req, res) {
      const rawId = req.params.id;
      if (typeof rawId !== 'string' || !/^[1-9]\d*$/.test(rawId)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'El identificador de colaborador debe ser un entero positivo.');
      }
      const mes = req.query?.mes ?? monthlyStore.DEFAULT_MONTH;
      if (typeof mes !== 'string' || !/^\d{4}-\d{2}$/.test(mes)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'El mes debe tener formato YYYY-MM válido.');
      }
      const profile = await monthlyStore.getCollaboratorProfile(Number(rawId), mes);
      if (!profile) throw new ApiError(404, 'NOT_FOUND', 'No se encontró el colaborador solicitado.');
      if (profile.invalidMonth) throw new ApiError(404, 'NOT_FOUND', 'No hay registros disponibles para el mes solicitado.');
      res.json({ data: profile });
    },
  };
}

const controller = createReportController();
module.exports = { ...controller, createReportController, pagination, validDate };
