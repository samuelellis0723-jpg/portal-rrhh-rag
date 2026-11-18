const { Router } = require('express');
const { getHealth } = require('../controllers/health-controller');
const auth = require('../controllers/auth-controller');
const { vacaciones } = require('../controllers/vacaciones-controller');
const { allowedOrigin, cors, requireAuth, requireRole, csrf } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { createLoginLimit } = require('../middleware/login-limit');

const router = Router();
router.get('/health', getHealth);
router.use(cors);
router.post('/auth/login', allowedOrigin, createLoginLimit(), validateRequest({ login: true }), auth.login);
router.get('/auth/session', requireAuth, validateRequest(), auth.session);
router.post('/auth/logout', requireAuth, allowedOrigin, csrf, validateRequest(), auth.logout);
router.get('/me/vacaciones', requireAuth, requireRole('colaborador', 'rrhh'), validateRequest({ pagination: true }), vacaciones);
router.use('/chat', require('./chat'));
router.use('/me', require('./personal'));
router.use(require('./report-routes'));

module.exports = router;
