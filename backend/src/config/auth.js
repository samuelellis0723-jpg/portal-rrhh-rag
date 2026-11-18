const { integer } = require('./env');

function authConfig() {
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => {
    try { return new URL(origin).origin !== origin || !/^https?:/.test(origin); } catch { return true; }
  })) throw new Error('ALLOWED_ORIGINS debe contener orígenes HTTP(S) explícitos.');
  const secret = process.env.CSRF_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('CSRF_SECRET requiere al menos 32 bytes.');
  const cookieName = process.env.SESSION_COOKIE_NAME || 'bosque_claro_sid';
  if (!/^[a-zA-Z0-9_-]+$/.test(cookieName)) throw new Error('SESSION_COOKIE_NAME inválido.');
  return {
    origins, secret, cookieName,
    ttl: integer('SESSION_TTL_HOURS', 8, 8, 8) * 3600000,
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
  };
}

module.exports = { authConfig };
