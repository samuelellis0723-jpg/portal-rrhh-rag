const ApiError = require('../services/api-error');

// Por proceso y dirección de conexión; no confiar en X-Forwarded-For del cliente.
function createLoginLimit({ max = 10, windowMs = 15 * 60 * 1000, capacity = 10000 } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = req.ip;
    let entry = attempts.get(key);
    if (!entry && attempts.size < capacity) {
      entry = { count: 0, until: now + windowMs };
      attempts.set(key, entry);
    }
    if (!entry || entry.count >= max) {
      res.set('Retry-After', String(Math.ceil(((entry?.until || now + windowMs) - now) / 1000)));
      throw new ApiError(429, 'RATE_LIMITED', 'Demasiados intentos. Intenta más tarde.');
    }
    entry.count += 1;
    next();
  };
}

module.exports = { createLoginLimit };
