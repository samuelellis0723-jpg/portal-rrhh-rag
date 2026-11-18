const test = require('node:test');
const assert = require('node:assert/strict');
const { createReportController } = require('../src/controllers/report-controller');

function response() { return { json(value) { this.body = value; return this; } }; }

test('historial valida paginación y solo lee metadatos persistidos', async () => {
  const calls = [];
  const controller = createReportController({ async list(page) {
    calls.push(page);
    return { count: 3, rows: [{ id: 9, fecha: '2026-11-17', generado_en: new Date('2026-11-17T13:00:00Z'),
      generado_por: 'agente_analista', origen: 'fixture', esquema_version: 1, resumen_texto: 'Fixture.' }] };
  } });
  const res = response();
  await controller.list({ query: { limit: '1', offset: '2' } }, res);
  assert.deepEqual(calls, [{ limit: 1, offset: 2 }]);
  assert.deepEqual(res.body.data, { items: [{ id: 9, fecha: '2026-11-17', generado_en: '2026-11-17T13:00:00.000Z',
    generado_por: 'agente_analista', origen: 'fixture', esquema_version: 1, resumen_texto: 'Fixture.' }], limit: 1, offset: 2, total: 3 });
  await assert.rejects(controller.list({ query: { limit: '101' } }, response()), { code: 'VALIDATION_ERROR' });
  await assert.rejects(controller.list({ query: { limit: '1.5' } }, response()), { code: 'VALIDATION_ERROR' });
});

test('detalle de fecha no genera ni fabrica reporte ausente', async () => {
  let lookups = 0;
  const controller = createReportController({ async findByDate(date) { lookups += 1; assert.equal(date, '2026-11-18'); return null; } });
  await assert.rejects(controller.getByDate({ params: { fecha: '2026-02-30' } }, response()), { code: 'VALIDATION_ERROR' });
  assert.equal(lookups, 0);
  await assert.rejects(controller.getByDate({ params: { fecha: '2026-11-18' } }, response()), { status: 404, code: 'NOT_FOUND' });
  assert.equal(lookups, 1);
});
