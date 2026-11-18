const { integer } = require('../config/env');
const ApiError = require('../services/api-error');

function createChatLimit({ max = integer('CHAT_RATE_LIMIT_PER_MINUTE', 30, 1, 120), windowMs = 60_000, clock = Date.now } = {}) {
  const recentByUser = new Map();
  return (req, res, next) => {
    const userId = req.auth?.data?.usuario?.id;
    if (!Number.isSafeInteger(userId)) throw new ApiError(401, 'UNAUTHENTICATED', 'Se requiere una sesión válida.');
    const now = clock();
    const recent = (recentByUser.get(userId) || []).filter((stamp) => now - stamp < windowMs);
    if (recent.length >= max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000))));
      throw new ApiError(429, 'RATE_LIMITED', 'Se alcanzó el límite de consultas. Intenta más tarde.');
    }
    recent.push(now);
    recentByUser.set(userId, recent);
    if (recentByUser.size > 10000) {
      for (const [id, stamps] of recentByUser) if (!stamps.some((stamp) => now - stamp < windowMs)) recentByUser.delete(id);
    }
    next();
  };
}

module.exports = { createChatLimit };
