const { Router } = require('express');
const controller = require('../controllers/chat-controller');
const { requireAuth, allowedOrigin, csrf } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { validateChat } = require('../middleware/chat-validation');
const { createChatLimit } = require('../middleware/chat-limit');

const router = Router();
router.delete('/historial', requireAuth, allowedOrigin, csrf, validateRequest(), controller.clear);
router.get('/historial', requireAuth, validateRequest({ pagination: true }), controller.history);
router.post('/', requireAuth, allowedOrigin, csrf, validateChat, createChatLimit(), (req, res, next) => controller.chat(req, res, next));

module.exports = router;
