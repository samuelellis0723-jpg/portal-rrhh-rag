const { Router } = require('express');
const { requireAuth, requireRole, allowedOrigin, csrf } = require('../middleware/auth');
const controller = require('../controllers/report-controller');
const { validateRequest } = require('../middleware/validation');
const ApiError = require('../services/api-error');

function validateGenerate(req, res, next) {
  if (Object.keys(req.query || {}).length > 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Campos o parámetros inválidos.');
  }
  const body = req.body;
  if (body === undefined) {
    if (req.headers?.['transfer-encoding'] || Number(req.headers?.['content-length']) > 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Campos o parámetros inválidos.');
    }
    return next();
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Campos o parámetros inválidos.');
  }
  const keys = Object.keys(body);
  if (keys.some((k) => k !== 'actualizar') || (body.actualizar !== undefined && typeof body.actualizar !== 'boolean')) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Campos o parámetros inválidos.');
  }
  next();
}

function validateProfileQuery(req, res, next) {
  const keys = Object.keys(req.query || {});
  if (keys.some((k) => k !== 'mes')) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Campos o parámetros inválidos.');
  }
  if (req.body !== undefined && (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body) || Object.keys(req.body).length)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Campos o parámetros inválidos.');
  }
  if (req.body === undefined && (req.headers?.['transfer-encoding'] || Number(req.headers?.['content-length']) > 0)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Campos o parámetros inválidos.');
  }
  next();
}

function createReportRouter({
  authenticate = requireAuth, authorize = requireRole, originCheck = allowedOrigin,
  csrfProtection = csrf, handlers = controller,
} = {}) {
  const router = Router();
  router.get('/rrhh/reportes', authenticate, authorize('rrhh'), validateRequest({ pagination: true }), handlers.list);
  router.post('/rrhh/reportes/generar', authenticate, authorize('rrhh'), originCheck, csrfProtection, validateGenerate, handlers.generate);
  router.get('/rrhh/reportes/:fecha', authenticate, authorize('rrhh'), validateRequest(), handlers.getByDate);
  router.get('/rrhh/reportes-mensuales', authenticate, authorize('rrhh'), validateRequest(), handlers.listMonthly);
  router.get('/rrhh/reportes-mensuales/:mes', authenticate, authorize('rrhh'), validateRequest(), handlers.getMonthly);
  router.get('/rrhh/colaboradores/:id/ficha', authenticate, authorize('rrhh'), validateProfileQuery, handlers.getCollaboratorProfile);
  return router;
}

module.exports = createReportRouter();
module.exports.createReportRouter = createReportRouter;
module.exports.validateGenerate = validateGenerate;
module.exports.validateProfileQuery = validateProfileQuery;
