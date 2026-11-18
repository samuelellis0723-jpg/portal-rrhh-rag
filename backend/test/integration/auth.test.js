const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const express = require('express');
const app = require('../../src/app');
const models = require('../../src/models');
const { authConfig } = require('../../src/config/auth');
const { requireAuth, requireRole } = require('../../src/middleware/auth');
const { errorHandler } = require('../../src/middleware/errors');
const repository = require('../../src/repositories/auth-repository');
const { ownBalance } = require('../../src/repositories/vacaciones-repository');

const config = authConfig();
const origin = config.origins[0];
const digest = (s) => createHash('sha256').update(s).digest('hex');
const sessions = [];
let server;
let base;

test.before(async () => {
  // Rutas exclusivas del arnés para verificar ambos middlewares de rol, sin publicar reportes.
  const root = express();
  root.get('/role/rrhh', requireAuth, requireRole('rrhh'), (req, res) => res.json({ ok: true }));
  root.get('/role/colaborador', requireAuth, requireRole('colaborador'), (req, res) => res.json({ ok: true }));
  root.use(app);
  root.use(errorHandler);
  server = root.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  // Eliminar exclusivamente las sesiones generadas por esta prueba; no tocar sesiones previas.
  if (sessions.length) await models.Sesion.destroy({ where: { token_hash: sessions.map((s) => s.hash) } });
  await models.sequelize.close();
});

async function request(path, { method = 'GET', cookie, csrf, body, headers = {} } = {}) {
  const response = await fetch(`${base}${path.startsWith('/role') ? '' : '/api/v1'}${path}`, {
    method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, data: text ? JSON.parse(text) : null };
}

async function login(role) {
  const result = await request('/auth/login', { method: 'POST', headers: { Origin: origin },
    body: { email: `${role}@bosqueclaro.example`, password: process.env[role === 'rrhh' ? 'DEMO_RRHH_PASSWORD' : 'DEMO_COLABORADOR_PASSWORD'] } });
  assert.equal(result.status, 200);
  const setCookie = result.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//);
  const cookie = setCookie.split(';')[0];
  const token = cookie.slice(config.cookieName.length + 1);
  const entry = { cookie, token, hash: digest(token), csrf: result.data.data.csrf_token, data: result.data.data };
  sessions.push(entry);
  assert.equal(JSON.stringify(result.data).includes(token), false);
  assert.deepEqual(Object.keys(entry.data.usuario).sort(), ['colaborador_id', 'email', 'id']);
  assert.deepEqual(Object.keys(entry.data.colaborador).sort(), ['id', 'nombre', 'rol']);
  assert.equal(typeof entry.data.usuario.id, 'number');
  assert.equal(entry.data.colaborador.rol, role);
  return entry;
}

test('recorrido de ambos roles: login, sesión, saldo propio, CSRF y logout revocado', async () => {
  const identities = [];
  for (const role of ['colaborador', 'rrhh']) {
    const entry = await login(role);
    identities.push(entry.data.colaborador.id);
    const stored = await models.Sesion.findOne({ where: { token_hash: entry.hash } });
    assert.ok(stored);
    assert.ok(stored.csrf_token_hash === digest(entry.csrf), 'CSRF almacenado como hash');
    assert.equal(stored.expira_en - stored.creada_en, 8 * 3600000);
    assert.equal(stored.revocada_en, null);
    let result = await request('/auth/session', entry);
    assert.equal(result.status, 200);
    assert.ok(JSON.stringify(result.data.data) === JSON.stringify(entry.data), 'sesión y CSRF estables');
    assert.equal(result.headers.get('cache-control'), 'no-store');
    const allowed = await request(`/role/${role}`, entry);
    assert.equal(allowed.status, 200);
    assert.equal((await request(`/role/${role === 'rrhh' ? 'colaborador' : 'rrhh'}`, entry)).status, 403);
    result = await request('/me/vacaciones', entry);
    assert.equal(result.status, 200);
    const expected = await models.SaldoVacaciones.findAll({ where: { colaborador_id: entry.data.colaborador.id },
      attributes: ['id', 'periodo_inicio', 'periodo_fin', 'dias_asignados', 'dias_tomados', 'dias_disponibles'],
      order: [['periodo_inicio', 'DESC'], ['id', 'ASC']], raw: true });
    assert.deepEqual(result.data.data.items, expected);
    assert.match(result.data.data.total_dias_disponibles, /^\d+\.\d{2}$/);
    const emptyPage = await request('/me/vacaciones?offset=100&limit=1', entry);
    assert.deepEqual(emptyPage.data.data.items, []);
    assert.equal(emptyPage.data.data.total, expected.length);
    assert.equal(emptyPage.data.data.total_dias_disponibles, result.data.data.total_dias_disponibles);
    for (const suffix of ['?colaborador_id=91000001', '?rol=rrhh', '?limit=0', '?limit=101', '?offset=-1', '?limit=1&limit=2', '?offset=1e3']) {
      assert.equal((await request(`/me/vacaciones${suffix}`, entry)).status, 400);
    }
    assert.equal((await request('/me/vacaciones', { ...entry, body: { colaborador_id: 91000001 }, method: 'POST' })).status, 404);
    assert.equal((await request('/auth/logout', { method: 'POST', cookie: entry.cookie, headers: { Origin: origin } })).status, 403);
    assert.equal((await request('/auth/logout', { ...entry, method: 'POST', csrf: 'a'.repeat(64), headers: { Origin: origin } })).status, 403);
    if (role === 'rrhh') {
      assert.equal((await request('/auth/logout', { ...entry, method: 'POST', csrf: sessions[0].csrf, headers: { Origin: origin } })).status, 403);
    }
    assert.equal((await request('/auth/logout', { ...entry, method: 'POST', headers: { Origin: 'https://ajeno.example' } })).status, 403);
    assert.equal((await request('/auth/session', entry)).status, 200);
    result = await request('/auth/logout', { ...entry, method: 'POST', headers: { Origin: origin } });
    assert.equal(result.status, 204);
    assert.match(result.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
    assert.ok((await stored.reload()).revocada_en);
    for (const path of ['/auth/session', '/me/vacaciones']) assert.equal((await request(path, entry)).status, 401);
    assert.equal((await request('/auth/logout', { ...entry, method: 'POST', headers: { Origin: origin } })).status, 401);
  }
  assert.notEqual(identities[0], identities[1]);
  assert.deepEqual(await ownBalance(-1, { limit: 20, offset: 0 }), {
    items: [], limit: 20, offset: 0, total: 0, total_dias_disponibles: '0.00',
  });
});

test('sesiones ausentes, falsificadas y expiradas; estado y rol se releen desde MySQL', async () => {
  for (const path of ['/auth/session', '/me/vacaciones']) {
    assert.equal((await request(path)).status, 401);
    assert.equal((await request(path, { cookie: `${config.cookieName}=${'f'.repeat(64)}` })).status, 401);
  }
  const entry = await login('colaborador');
  const user = await models.Usuario.findByPk(entry.data.usuario.id);
  const person = await models.Colaborador.findByPk(entry.data.colaborador.id);
  try {
    await user.update({ estado: 'bloqueado' });
    assert.equal((await request('/auth/session', entry)).status, 401);
    await user.update({ estado: 'activo' });
    await person.update({ estado: 'inactivo' });
    assert.equal((await request('/me/vacaciones', entry)).status, 401);
    await person.update({ estado: 'activo', rol: 'rrhh' });
    assert.equal((await request('/role/rrhh', entry)).status, 200);
    assert.equal((await request('/role/colaborador', entry)).status, 403);
  } finally {
    await user.update({ estado: 'activo' });
    await person.update({ estado: 'activo', rol: 'colaborador' });
  }
  await models.Sesion.update({ creada_en: new Date(Date.now() - 10 * 3600000), expira_en: new Date(Date.now() - 1000) }, { where: { token_hash: entry.hash } });
  assert.equal((await request('/auth/session', entry)).status, 401);
});

test('credenciales inválidas genéricas, validación, origen y CORS', async () => {
  const failed = [];
  for (const email of ['colaborador@bosqueclaro.example', 'noexiste@bosqueclaro.example']) {
    const result = await request('/auth/login', { method: 'POST', headers: { Origin: origin }, body: { email, password: 'incorrecta' } });
    assert.equal(result.status, 401);
    failed.push(result.data);
  }
  assert.deepEqual(failed[0], failed[1]);
  for (const body of [{}, [], { email: 42, password: 'x' }, { email: 'a@b.example', password: 'x', rol: 'rrhh' }]) {
    assert.equal((await request('/auth/login', { method: 'POST', headers: { Origin: origin }, body })).status, 400);
  }
  assert.equal((await request('/auth/login', { method: 'POST' })).status, 403);
  assert.equal((await request('/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' } })).status, 415);
  const preflight = await request('/auth/login', { method: 'OPTIONS', headers: { Origin: origin } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  assert.equal((await request('/auth/login', { method: 'OPTIONS', headers: { Origin: 'https://ajeno.example' } })).status, 403);
});

test('límite real de login rechaza intentos adicionales; errores de dependencia no exponen detalles', async () => {
  let limited;
  for (let i = 0; i < 11; i += 1) {
    limited = await request('/auth/login', { method: 'POST', headers: { Origin: origin }, body: {} });
    if (limited.status === 429) break;
  }
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  const original = repository.findSession;
  try {
    repository.findSession = async () => { throw new (require('sequelize').ConnectionError)(new Error('secreto SQL')); };
    const result = await request('/auth/session', { cookie: `${config.cookieName}=${'f'.repeat(64)}` });
    assert.equal(result.status, 503);
    assert.equal(JSON.stringify(result.data).includes('SQL'), false);
  } finally { repository.findSession = original; }
});
