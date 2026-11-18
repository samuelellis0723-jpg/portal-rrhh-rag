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
  };
  const authenticate = (req, res, next) => { req.auth = { role: req.get('x-test-role') || 'anonymous' }; next(); };
  const authorize = (role) => (req, res, next) => req.auth.role === role
    ? next() : res.status(403).json({ error: { code: 'FORBIDDEN' } });
  const router = createReportRouter({ authenticate, authorize, handlers });
  const routes = router.stack.filter((layer) => layer.route);
  assert.deepEqual(routes.map((layer) => layer.route.path), ['/rrhh/reportes', '/rrhh/reportes/:fecha']);
  async function request(path, role, query = {}, body = undefined) {
    const route = routes.find((layer) => layer.route.path === path);
    const req = { query, body, params: { fecha: '2026-11-18' }, get(name) { return name.toLowerCase() === 'x-test-role' ? role : undefined; }, headers: {} };
    const res = response();
    await run(route.route.stack, req, res);
    return res;
  }
  let result = await request('/rrhh/reportes', 'colaborador');
  assert.equal(result.statusCode, 403);
  await assert.rejects(request('/rrhh/reportes', 'rrhh', { limit: '1', colaborador_id: '7' }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(request('/rrhh/reportes', 'rrhh', { limit: '0' }), { code: 'VALIDATION_ERROR' });
  result = await request('/rrhh/reportes', 'rrhh', { limit: '2', offset: '1' });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.data, { limit: 2, offset: 1 });
  await assert.rejects(request('/rrhh/reportes/:fecha', 'rrhh', { rol: 'rrhh' }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(request('/rrhh/reportes/:fecha', 'rrhh', {}, { colaborador_id: 7 }), { code: 'VALIDATION_ERROR' });
  assert.deepEqual(calls, [['list', { limit: 2, offset: 1 }]]);
});
