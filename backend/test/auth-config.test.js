const test = require('node:test');
const assert = require('node:assert/strict');
const { authConfig } = require('../src/config/auth');

test('configuración de sesión exige secreto, orígenes explícitos y cookie Secure en producción', () => {
  const keys = ['NODE_ENV', 'ALLOWED_ORIGINS', 'CSRF_SECRET', 'SESSION_COOKIE_NAME', 'SESSION_TTL_HOURS'];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, { NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://portal.bosqueclaro.example',
      CSRF_SECRET: 'secreto-sintetico-exclusivo-de-prueba-32', SESSION_COOKIE_NAME: 'test_sid', SESSION_TTL_HOURS: '8' });
    const config = authConfig();
    assert.deepEqual(config.cookie, { secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
    process.env.ALLOWED_ORIGINS = '*';
    assert.throws(authConfig, /ALLOWED_ORIGINS/);
    process.env.ALLOWED_ORIGINS = 'https://portal.bosqueclaro.example';
    process.env.CSRF_SECRET = '';
    assert.throws(authConfig, /CSRF_SECRET/);
    process.env.CSRF_SECRET = 'secreto-sintetico-exclusivo-de-prueba-32';
    process.env.SESSION_TTL_HOURS = '24';
    assert.throws(authConfig, /SESSION_TTL_HOURS/);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
