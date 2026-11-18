const ApiError = require('../services/api-error');
const invalid = () => { throw new ApiError(400, 'VALIDATION_ERROR', 'Campos o parámetros inválidos.'); };

function validateChat(req, res, next) {
  if (!req.is('application/json')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Se requiere application/json.');
  if (Object.keys(req.query).length) invalid();
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1
    || !Object.hasOwn(body, 'mensaje') || typeof body.mensaje !== 'string') invalid();
  const mensaje = body.mensaje.trim();
  if (!mensaje || mensaje.length > 4000) invalid();
  req.chatMessage = mensaje;
  next();
}

module.exports = { validateChat };
