const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controllers/report-controller');
const { validateRequest } = require('../middleware/validation');

function createReportRouter({ authenticate = requireAuth, authorize = requireRole, handlers = controller } = {}) {
  const router = Router();
  router.get('/rrhh/reportes', authenticate, authorize('rrhh'), validateRequest({ pagination: true }), handlers.list);
  router.get('/rrhh/reportes/:fecha', authenticate, authorize('rrhh'), validateRequest(), handlers.getByDate);
  return router;
}

module.exports = createReportRouter();
module.exports.createReportRouter = createReportRouter;
