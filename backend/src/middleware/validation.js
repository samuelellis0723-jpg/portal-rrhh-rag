const ApiError = require('../services/api-error');
const invalid = () => { throw new ApiError(400, 'VALIDATION_ERROR', 'Campos o parámetros inválidos.'); };

function validateRequest({ login = false, pagination = false } = {}) {
  return (req, res, next) => {
    const queryKeys = pagination ? ['limit', 'offset'] : [];
    if (Object.keys(req.query).some((k) => !queryKeys.includes(k))) invalid();
    if (login) {
      if (!req.is('application/json')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Se requiere application/json.');
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).length !== 2 || !Object.hasOwn(body, 'email') || !Object.hasOwn(body, 'password')
        || typeof body.email !== 'string' || body.email.length > 254
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
        || typeof body.password !== 'string' || !body.password.length || body.password.length > 256) invalid();
    } else if (req.body !== undefined && (typeof req.body !== 'object' || req.body === null
      || Array.isArray(req.body) || Object.keys(req.body).length)) invalid();
    // También rechazar cuerpos de tipos que express.json no procesa.
    if (!login && req.body === undefined && (req.headers['transfer-encoding'] || Number(req.headers['content-length']) > 0)) invalid();
    if (pagination) {
      const parse = (key, fallback, min, max) => {
        const value = req.query[key];
        if (value === undefined) return fallback;
        if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) invalid();
        const n = Number(value);
        if (!Number.isSafeInteger(n) || n < min || n > max) invalid();
        return n;
      };
      req.pagination = { limit: parse('limit', 20, 1, 100), offset: parse('offset', 0, 0, Number.MAX_SAFE_INTEGER) };
    }
    next();
  };
}

module.exports = { validateRequest };
