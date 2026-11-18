const test = require('node:test');
const assert = require('node:assert/strict');
const { generateDailyReport } = require('../src/services/report-service');

test('preserva fixtures y cualquier reporte previo sin inicializar el LLM', async () => {
  let generated = false;
  const fixture = { fecha: '2026-11-17', origen: 'fixture', resumen_texto: 'fixture anterior' };
  const store = {
    async withDateLock(date, fn) { assert.equal(date, '2026-11-17'); return { acquired: true, result: await fn() }; },
    async findByDate() { return fixture; },
  };
  const agent = { async generate() { generated = true; throw new Error('no debe ejecutarse'); } };
  const result = await generateDailyReport('2026-11-17', { store, agent });
  assert.equal(result.status, 'exists');
  assert.equal(result.report, fixture);
  assert.equal(generated, false);
});

test('bloqueo MySQL ocupado evita generar y persistir un duplicado', async () => {
  let generated = false;
  const store = { async withDateLock() { return { acquired: false }; } };
  const result = await generateDailyReport('2026-11-18', { store, agent: { async generate() { generated = true; } } });
  assert.equal(result.status, 'busy');
  assert.equal(generated, false);
});

test('genera solo después de agregación y guarda un registro de ejecución no fixture', async () => {
  const calls = [];
  const store = {
    async withDateLock(date, fn) { calls.push(['lock', date]); return { acquired: true, result: await fn() }; },
    async findByDate() { return null; },
    async createExecution(values) { calls.push(['create', values]); return { id: 3, fecha: values.date, origen: 'ejecucion' }; },
    async logAnalystExecution(values) { calls.push(['log', values]); },
  };
  const agent = { async generate(date) { calls.push(['generate', date]); return { date, data: { resumen_ejecutivo: 'x' }, summary: 'resumen', generatedAt: new Date('2026-11-18T13:00:00Z') }; } };
  const result = await generateDailyReport('2026-11-18', { store, agent });
  assert.equal(result.status, 'created');
  assert.deepEqual(calls.map((item) => item[0]), ['lock', 'generate', 'create', 'log']);
  assert.equal(calls[2][1].summary, 'resumen');
  assert.equal(calls[3][1].state, 'completada');
});

test('si el proveedor LLM falla no persiste ni oculta el reporte anterior', async () => {
  let created = false;
  const calls = [];
  const store = {
    async withDateLock(_date, fn) { return { acquired: true, result: await fn() }; },
    async findByDate() { return null; },
    async createExecution() { created = true; },
    async logAnalystExecution(log) { calls.push(log.state); },
  };
  await assert.rejects(generateDailyReport('2026-11-18', { store, agent: { async generate() { throw new Error('DEEPSEEK_API_KEY_MISSING'); } } }), /DEEPSEEK_API_KEY_MISSING/);
  assert.equal(created, false);
  assert.deepEqual(calls, ['fallida']);
});
