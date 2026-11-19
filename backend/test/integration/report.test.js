const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../../src/models');
const { aggregateReport } = require('../../src/repositories/report-repository');
const { getMonthlyReport, getCollaboratorProfile, AVAILABLE_MONTHS } = require('../../src/repositories/monthly-report-repository');
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
  const stripNombre = (rows) => rows.map(({ nombre, ...rest }) => {
    assert.ok(typeof nombre === 'string' && nombre.trim().length > 0);
    return rest;
  });
  assert.deepEqual({ ...actual.solicitudes_pendientes, items: stripNombre(actual.solicitudes_pendientes.items) }, expected.solicitudes_pendientes);
  assert.deepEqual(actual.incapacidades, expected.incapacidades);
  const { disponible, ...movement } = actual.movimientos_personal;
  assert.equal(disponible, true);
  assert.deepEqual(movement, expected.movimientos_personal);
  assert.equal(actual.riesgo_vacaciones.total_colaboradores, expected.riesgo_vacaciones.total_colaboradores);
  assert.deepEqual(stripNombre(actual.riesgo_vacaciones.items).toSorted((a,b) => a.colaborador_id-b.colaborador_id), expected.riesgo_vacaciones.items.toSorted((a,b) => a.colaborador_id-b.colaborador_id));
  assert.deepEqual(actual.uso_chatbot, expected.uso_chatbot);
  assert.equal(actual.temas_chatbot.top_5.reduce((sum, row) => sum + row.consultas, 0),
    expected.temas_chatbot.top_5.reduce((sum, row) => sum + row.consultas, 0));
  assert.equal(actual.temas_chatbot.sin_respuesta.reduce((sum, row) => sum + row.consultas, 0),
    expected.temas_chatbot.sin_respuesta.reduce((sum, row) => sum + row.consultas, 0));
  assert.equal(actual.uso_chatbot.tendencia_30_dias.length, 30);
  assert.equal(actual.uso_chatbot.tendencia_30_dias[0].fecha, '2026-10-18');
  assert.equal(actual.uso_chatbot.tendencia_30_dias.at(-1).fecha, '2026-11-16');
  assert.ok(actual.temas_chatbot.sin_respuesta.every((row) => !/persona\d+|@|910000/.test(row.pregunta)));
  assert.ok(actual.detalle_personas.total > 0);
  assert.ok(actual.detalle_personas.items.every((row) => typeof row.nombre === 'string' && row.nombre.length > 0));
});

test('reportes mensuales y ficha individual concilian con MySQL para los 3 meses sin salarios ni diagnósticos', async () => {
  for (const period of AVAILABLE_MONTHS) {
    const monthly = await getMonthlyReport(period.mes);
    assert.equal(monthly.mes, period.mes);
    assert.equal(monthly.fecha_inicio, period.fecha_inicio);
    assert.equal(monthly.fecha_fin, period.fecha_fin);
    assert.equal(monthly.asistencia.dias_trabajados, monthly.asistencia.dias_puntuales + monthly.asistencia.tardias);
    assert.equal(monthly.asistencia.ausencias_justificadas.total,
      monthly.asistencia.ausencias_justificadas.vacaciones + monthly.asistencia.ausencias_justificadas.permiso + monthly.asistencia.ausencias_justificadas.incapacidad);
    assert.ok(monthly.asistencia.dias_programados > 0);
    assert.ok(monthly.asistencia.formula_porcentaje_asistencia.includes('tardías'));
  }
  const oct = await getCollaboratorProfile(91000005, '2026-10');
  const sep = await getCollaboratorProfile(91000005, '2026-09');
  assert.equal(oct.colaborador.nombre, 'Camila Alfaro Murillo');
  assert.equal(oct.periodo.mes, '2026-10');
  assert.equal(sep.periodo.mes, '2026-09');
  assert.equal(oct.resumen.dias_trabajados, oct.resumen.dias_puntuales + oct.resumen.tardias);
  assert.equal(oct.colaborador.salario, undefined);
  assert.equal(oct.colaborador.monto, undefined);
  assert.ok(oct.registro_diario.every((d) => d.fecha >= '2026-10-01' && d.fecha <= '2026-10-31'));
  assert.ok(sep.registro_diario.every((d) => d.fecha >= '2026-09-01' && d.fecha <= '2026-09-30'));
});
