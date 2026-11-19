const test = require('node:test');
const assert = require('node:assert/strict');
const { createReportRouter } = require('../src/routes/report-routes');

function run(stack, req, res) {
  return new Promise((resolve, reject) => {
    res.end = resolve;
    let index = 0;
    const next = (error) => {
      if (error) return reject(error);
      const layer = stack[index++];
      if (!layer) return resolve();
      try { Promise.resolve(layer.handle(req, res, next)).catch(reject); } catch (cause) { reject(cause); }
    };
    next();
  });
}
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; this.end?.(); return this; } };
}

test('rutas de reportes exigen rol RRHH y aplican validación strict de query y body', async () => {
  const calls = [];
  const handlers = {
    async list(req, res) { calls.push(['list', req.pagination]); res.json({ data: req.pagination }); },
    async getByDate(req, res) { calls.push(['detail', req.params.fecha]); res.json({ data: { fecha: req.params.fecha } }); },
    async generate(req, res) { calls.push(['generate', Boolean(req.body?.actualizar)]); res.status(200).json({ data: { ok: true } }); },
    async listMonthly(_req, res) { calls.push(['listMonthly']); res.json({ data: { items: [] } }); },
    async getMonthly(req, res) { calls.push(['getMonthly', req.params.mes]); res.json({ data: { mes: req.params.mes } }); },
    async getCollaboratorProfile(req, res) { calls.push(['profile', req.params.id, req.query.mes]); res.json({ data: { id: req.params.id } }); },
  };
  const authenticate = (req, res, next) => { req.auth = { role: req.get('x-test-role') || 'anonymous' }; next(); };
  const authorize = (role) => (req, res, next) => req.auth.role === role
    ? next() : res.status(403).json({ error: { code: 'FORBIDDEN' } });
  const originCheck = (req, res, next) => req.get('x-test-origin') === 'bad'
    ? res.status(403).json({ error: { code: 'ORIGIN_NOT_ALLOWED' } }) : next();
  const csrfProtection = (req, res, next) => req.get('x-test-csrf') === 'bad'
    ? res.status(403).json({ error: { code: 'CSRF_INVALID' } }) : next();
  const router = createReportRouter({ authenticate, authorize, originCheck, csrfProtection, handlers });
  const routes = router.stack.filter((layer) => layer.route);
  assert.deepEqual(routes.map((layer) => layer.route.path), [
    '/rrhh/reportes', '/rrhh/reportes/generar', '/rrhh/reportes/:fecha',
    '/rrhh/reportes-mensuales', '/rrhh/reportes-mensuales/:mes', '/rrhh/colaboradores/:id/ficha',
  ]);
  async function request(path, role, query = {}, body = undefined, extraHeaders = {}) {
    const route = routes.find((layer) => layer.route.path === path);
    const req = { query, body, params: { fecha: '2026-11-18', mes: '2026-10', id: '91000005' }, get(name) {
      const k = name.toLowerCase();
      if (k === 'x-test-role') return role;
      return extraHeaders[k];
    }, headers: {} };
    const res = response();
    await run(route.route.stack, req, res);
    return res;
  }
  let result = await request('/rrhh/reportes', 'colaborador');
  assert.equal(result.statusCode, 403);
  result = await request('/rrhh/reportes/generar', 'colaborador');
  assert.equal(result.statusCode, 403);
  result = await request('/rrhh/reportes-mensuales', 'colaborador');
  assert.equal(result.statusCode, 403);
  result = await request('/rrhh/reportes-mensuales/:mes', 'colaborador');
  assert.equal(result.statusCode, 403);
  result = await request('/rrhh/colaboradores/:id/ficha', 'colaborador');
  assert.equal(result.statusCode, 403);
  result = await request('/rrhh/reportes/generar', 'rrhh', {}, { actualizar: false }, { 'x-test-csrf': 'bad' });
  assert.equal(result.statusCode, 403);
  await assert.rejects(request('/rrhh/reportes/generar', 'rrhh', {}, { fecha: '2026-11-18' }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(request('/rrhh/colaboradores/:id/ficha', 'rrhh', { colaborador_id: '1' }), { code: 'VALIDATION_ERROR' });
  result = await request('/rrhh/colaboradores/:id/ficha', 'rrhh', { mes: '2026-10' });
  assert.equal(result.statusCode, 200);
  result = await request('/rrhh/reportes-mensuales/:mes', 'rrhh');
  assert.equal(result.statusCode, 200);
  result = await request('/rrhh/reportes/generar', 'rrhh', {}, { actualizar: true });
  assert.equal(result.statusCode, 200);
  await assert.rejects(request('/rrhh/reportes', 'rrhh', { limit: '1', colaborador_id: '7' }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(request('/rrhh/reportes', 'rrhh', { limit: '0' }), { code: 'VALIDATION_ERROR' });
  result = await request('/rrhh/reportes', 'rrhh', { limit: '2', offset: '1' });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.data, { limit: 2, offset: 1 });
  await assert.rejects(request('/rrhh/reportes/:fecha', 'rrhh', { rol: 'rrhh' }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(request('/rrhh/reportes/:fecha', 'rrhh', {}, { colaborador_id: 7 }), { code: 'VALIDATION_ERROR' });
  assert.deepEqual(calls, [['profile', '91000005', '2026-10'], ['getMonthly', '2026-10'], ['generate', true], ['list', { limit: 2, offset: 1 }]]);
});
