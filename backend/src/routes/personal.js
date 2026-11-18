const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const controller = require('../controllers/personal-controller');

const router = Router();
const own = [requireAuth, requireRole('colaborador', 'rrhh')];
router.get('/proximo-pago', ...own, validateRequest(), controller.getNextPayment);
router.get('/proxima-evaluacion', ...own, validateRequest(), controller.getNextEvaluation);
router.get('/solicitudes', ...own, validateRequest({ pagination: true }), controller.getRequests);

module.exports = router;
