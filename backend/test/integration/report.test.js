const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../../src/models');
const { aggregateReport } = require('../../src/repositories/report-repository');
const { buildFixtures } = require('../../src/fixtures/bosque-claro');

let available = false;
test.before(async (t) => {
  try {
    await models.sequelize.authenticate();
    const fixture = buildFixtures().reportes_diarios.find((row) => row.fecha === '2026-11-17');
    const row = await models.ReporteDiario.findOne({ where: { fecha: '2026-11-17' } });
    available = Boolean(fixture && row?.origen === 'fixture');
    if (!available) t.skip('La base de integración no tiene el fixture del 17-11-2026.');
  } catch { t.skip('MySQL de integración no está disponible.'); }
});
test.after(async () => { await models.sequelize.close(); });

test('SQL diario reconcilia los agregados contra fixture determinista y corte 07:00 Costa Rica', async () => {
  const expected = buildFixtures().reportes_diarios.find((row) => row.fecha === '2026-11-17').datos_json;
  const actual = await aggregateReport('2026-11-17');
  assert.equal(actual.ausencias.total, expected.ausencias.total);
  assert.deepEqual(actual.ausencias.por_tipo, expected.ausencias.por_tipo);
  const byDepartment = (rows) => rows.toSorted((a, b) => a.departamento.localeCompare(b.departamento, 'es'));
  assert.deepEqual(byDepartment(actual.ausencias.por_departamento), byDepartment(expected.ausencias.por_departamento));
  assert.deepEqual(actual.solicitudes_pendientes, expected.solicitudes_pendientes);
  assert.deepEqual(actual.incapacidades, expected.incapacidades);
  const { disponible, ...movement } = actual.movimientos_personal;
  assert.equal(disponible, true);
  assert.deepEqual(movement, expected.movimientos_personal);
  assert.equal(actual.riesgo_vacaciones.total_colaboradores, expected.riesgo_vacaciones.total_colaboradores);
  assert.deepEqual(actual.riesgo_vacaciones.items.toSorted((a,b) => a.colaborador_id-b.colaborador_id), expected.riesgo_vacaciones.items.toSorted((a,b) => a.colaborador_id-b.colaborador_id));
  assert.deepEqual(actual.uso_chatbot, expected.uso_chatbot);
  assert.equal(actual.temas_chatbot.top_5.reduce((sum, row) => sum + row.consultas, 0),
    expected.temas_chatbot.top_5.reduce((sum, row) => sum + row.consultas, 0));
  assert.equal(actual.temas_chatbot.sin_respuesta.reduce((sum, row) => sum + row.consultas, 0),
    expected.temas_chatbot.sin_respuesta.reduce((sum, row) => sum + row.consultas, 0));
  assert.equal(actual.uso_chatbot.tendencia_30_dias.length, 30);
  assert.equal(actual.uso_chatbot.tendencia_30_dias[0].fecha, '2026-10-18');
  assert.equal(actual.uso_chatbot.tendencia_30_dias.at(-1).fecha, '2026-11-16');
  assert.ok(actual.temas_chatbot.sin_respuesta.every((row) => !/persona\d+|@|910000/.test(row.pregunta)));
});
