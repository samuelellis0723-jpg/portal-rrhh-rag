const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFixtures, START, END } = require('../src/fixtures/bosque-claro');
const { hashPassword, verifyPassword } = require('../src/services/password-service');

test('fixture reproducible: 60 personas, tres meses y relaciones sin huérfanos', () => {
  const data = buildFixtures();
  assert.deepEqual(data, buildFixtures());
  assert.equal(data.colaboradores.length, 60);
  const people = new Set(data.colaboradores.map((p) => p.id));
  assert.equal(new Set(data.colaboradores.map((p) => p.correo)).size, 60);
  for (const records of Object.values(data)) for (const record of records) {
    if (record.colaborador_id) assert.ok(people.has(record.colaborador_id));
  }
  const days = [...new Set(data.consultas_chat.map((r) => r.creada_en.slice(0, 10)))];
  assert.equal(days[0], START);
  assert.equal(days.at(-1), END);
  assert.equal(days.length, 92);
  for (const person of data.colaboradores) {
    const movements = data.movimientos_personal.filter((m) => m.colaborador_id === person.id);
    assert.ok(movements.some((m) => m.tipo === 'ingreso' && m.fecha === person.fecha_ingreso));
  }
});

test('saldos concilian con vacaciones aprobadas; reportes tienen cifras consistentes', () => {
  const data = buildFixtures();
  for (const saldo of data.saldos_vacaciones) {
    const taken = data.solicitudes.filter((s) => s.colaborador_id === saldo.colaborador_id && s.estado === 'aprobada' && s.tipo === 'vacaciones' && s.fecha_inicio <= END).length;
    assert.equal(Number(saldo.dias_tomados), taken);
    assert.equal(Number(saldo.dias_disponibles), Number(saldo.dias_asignados) - taken);
  }
  for (const report of data.reportes_diarios) {
    assert.equal(report.origen, 'fixture');
    assert.equal(Object.keys(report.datos_json).length, 8);
    assert.equal(report.datos_json.uso_chatbot.tendencia_30_dias.length, 30);
    assert.equal(report.datos_json.resumen_ejecutivo, report.resumen_texto);
    assert.equal(report.datos_json.riesgo_vacaciones.total_colaboradores, report.datos_json.riesgo_vacaciones.items.length);
  }
  const latest = data.reportes_diarios.at(-1).datos_json;
  assert.ok(latest.solicitudes_pendientes.mas_de_3_dias > 0);
  assert.ok(latest.incapacidades.activas > 0);
  assert.ok(latest.riesgo_vacaciones.total_colaboradores > 0);
  assert.equal(data.sesiones, undefined);
  assert.equal(data.drive_sync_state, undefined);
});

test('hash de contraseña con sal aleatoria, verificación y rechazo de hashes inválidos', async () => {
  const password = 'ClaveSinteticaSoloPrueba_123';
  const a = await hashPassword(password);
  const b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.ok(await verifyPassword(password, a));
  assert.equal(await verifyPassword(`${password}!`, a), false);
  assert.equal(await verifyPassword(password, 'scrypt$999999999$8$1$bad$bad'), false);
  assert.equal(a.includes(password), false);
});
