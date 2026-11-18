const { randomBytes, createHash, createHmac, timingSafeEqual } = require('node:crypto');
const repository = require('../repositories/auth-repository');
const { verifyPassword } = require('./password-service');
const { authConfig } = require('../config/auth');
const ApiError = require('./api-error');

const hash = (value) => createHash('sha256').update(value).digest('hex');
const csrfToken = (token) => createHmac('sha256', authConfig().secret).update(token).digest('hex');
// Mantener el coste scrypt incluso cuando el correo no corresponde a una cuenta.
const dummyHash = `scrypt$16384$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
const active = (user) => user && user.estado === 'activo' && user.colaborador.estado === 'activo';

function publicSession(session, csrf) {
  const user = session.usuario;
  const person = user.colaborador;
  return {
    usuario: { id: user.id, colaborador_id: person.id, email: person.correo },
    colaborador: { id: person.id, nombre: person.nombre, rol: person.rol },
    csrf_token: csrf,
    expires_at: session.expira_en.toISOString(),
  };
}

async function login(email, password) {
  const user = await repository.findUser(email);
  const valid = await verifyPassword(password, user ? user.password_hash : dummyHash);
  if (!valid || !active(user)) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña inválidos.');
  const token = randomBytes(32).toString('hex');
  const csrf = csrfToken(token);
  const now = new Date();
  // MySQL DATETIME tiene precisión de segundos en el esquema v1.
  now.setMilliseconds(0);
  const session = await repository.createSession({ usuario_id: user.id, token_hash: hash(token),
    csrf_token_hash: hash(csrf), creada_en: now, expira_en: new Date(now.getTime() + authConfig().ttl) });
  session.usuario = user;
  return { token, session, data: publicSession(session, csrf) };
}

async function authenticate(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Se requiere una sesión válida.');
  }
  const session = await repository.findSession(hash(token));
  if (!session || !active(session.usuario)) throw new ApiError(401, 'UNAUTHENTICATED', 'Se requiere una sesión válida.');
  const csrf = csrfToken(token);
  if (!safeEqual(hash(csrf), session.csrf_token_hash)) throw new ApiError(401, 'UNAUTHENTICATED', 'Se requiere una sesión válida.');
  return { session, data: publicSession(session, csrf) };
}

function safeEqual(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.length === b.length
    && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

module.exports = { login, authenticate, hash, safeEqual, logout: repository.revokeSession };
