const { scrypt: scryptCallback, randomBytes, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(scryptCallback);
const settings = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
    throw new Error('La contraseña de demo debe tener entre 12 y 256 caracteres.');
  }
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64, settings);
  return `scrypt$16384$8$1$${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 256 || typeof encoded !== 'string') return false;
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts.slice(0, 4).join('$') !== 'scrypt$16384$8$1'
    || !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false;
  const derived = await scrypt(password, parts[4], 64, settings);
  return timingSafeEqual(derived, Buffer.from(parts[5], 'hex'));
}

module.exports = { hashPassword, verifyPassword };
