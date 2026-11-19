const { authConfig } = require('../config/auth');
const service = require('../services/auth-service');
const ApiError = require('../services/api-error');

function allowedOrigin(req, res, next) {
  if (!authConfig().origins.includes(req.get('Origin'))) {
    throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origen no permitido.');
  }
  next();
}

function cors(req, res, next) {
  res.vary('Origin');
  const origin = req.get('Origin');
  if (origin && authConfig().origins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    allowedOrigin(req, res, () => {});
    res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    return res.sendStatus(204);
  }
  next();
}

async function requireAuth(req, res, next) {
  const name = authConfig().cookieName;
  const matches = (req.headers.cookie || '').split(';').map((s) => s.trim()).filter((s) => s.startsWith(`${name}=`));
  req.auth = await service.authenticate(matches.length === 1 ? matches[0].slice(name.length + 1) : undefined);
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Se requiere una sesión válida.');
    if (!roles.includes(req.auth.data.colaborador.rol)) {
      throw new ApiError(403, 'FORBIDDEN', 'No tienes permiso para consultar este recurso.');
    }
    next();
  };
}

function csrf(req, res, next) {
  const token = req.get('X-CSRF-Token');
  if (!token || !/^[a-f0-9]{64}$/.test(token)
    || !service.safeEqual(service.hash(token), req.auth.session.csrf_token_hash)) {
    throw new ApiError(403, 'CSRF_INVALID', 'Token CSRF inválido.');
  }
  next();
}

module.exports = { allowedOrigin, cors, requireAuth, requireRole, csrf };
