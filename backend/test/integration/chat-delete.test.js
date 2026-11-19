const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const models = require('../../src/models');
const repository = require('../../src/repositories/personal-chat-repository');
const { aggregateReport } = require('../../src/repositories/report-repository');
const app = require('../../src/app');
const { authConfig } = require('../../src/config/auth');
const origin = authConfig().origins[0];
const people = [], users = [];
let server, base, actors;
const day = '2099-12-30';

test.before(async () => {
  // Identidades de prueba separadas: nunca eliminar conversaciones previas de las cuentas demo.
  const demo = await models.Usuario.findOne({ include: [{ model: models.Colaborador, as: 'colaborador', where: { correo: 'colaborador@bosqueclaro.example' } }] });
  for (const suffix of ['a', 'b']) {
    const email = `delete-${suffix}-${randomUUID()}@bosqueclaro.example`;
    const person = await models.Colaborador.create({ nombre: `Prueba Borrado ${suffix}`, correo: email, departamento: 'Pruebas',
      puesto: 'Prueba temporal', fecha_ingreso: '2099-01-01', estado: 'activo', rol: 'colaborador' });
    people.push(person.id);
    const user = await models.Usuario.create({ colaborador_id: person.id, email, password_hash: demo.password_hash, estado: 'activo', creado_en: new Date() });
    users.push(user.id);
  }
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
  actors = [];
  for (const id of users) {
    const user = await models.Usuario.findByPk(id, { include: [{ model: models.Colaborador, as: 'colaborador' }] });
    const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.colaborador.correo, password: process.env.DEMO_COLABORADOR_PASSWORD }) });
    assert.equal(response.status, 200);
    const payload = await response.json();
    actors.push({ cookie: response.headers.get('set-cookie').split(';')[0], csrf: payload.data.csrf_token });
  }
});
test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  const rows = await models.ConsultaChat.findAll({ where: { colaborador_id: people }, attributes: ['id'] });
  if (rows.length) await models.AgentExecutionLog.destroy({ where: { consulta_chat_id: rows.map((row) => row.id) } });
  await models.ConsultaChat.destroy({ where: { colaborador_id: people } });
  await models.Sesion.destroy({ where: { usuario_id: users } });
  await models.Usuario.destroy({ where: { id: users } });
  await models.Colaborador.destroy({ where: { id: people } });
  await models.ChatMetricaEliminada.destroy({ where: { fecha: day } });
  await models.sequelize.close();
});
async function entry(person, text, latency = 40) {
  const row = await models.ConsultaChat.create({ colaborador_id: person, pregunta: text, intencion: 'politica', tema: 'vacaciones', origen: 'ejecucion',
    respuesta_json: { respuesta: `Respuesta privada: ${text}`, estado: 'respondida' }, documentos_citados: [{ documento: 'Prueba' }],
    resuelta: true, escalada: false, latencia_ms: latency, creada_en: new Date(`${day}T12:00:00Z`) });
  await repository.addExecution({ consulta_chat_id: row.id, agente: 'politicas', consulta: text, contexto: { privado: text },
    estado: 'completada', iniciada_en: new Date(), origen: 'ejecucion' });
  return row;
}
async function clear(actor, suffix = '', { csrf = actor.csrf, body } = {}) {
  return fetch(`${base}/chat/historial${suffix}`, { method: 'DELETE', headers: { Origin: origin, Cookie: actor.cookie,
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

test('borrado HTTP exige sesión y CSRF, rechaza identidad ajena y conserva agregados sin contenido', async () => {
  assert.equal((await fetch(`${base}/chat/historial`, { method: 'DELETE' })).status, 401);
  const preflight = await fetch(`${base}/chat/historial`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'DELETE' } });
  assert.match(preflight.headers.get('access-control-allow-methods'), /DELETE/);
  const first = await entry(people[0], 'Texto exclusivo A');
  const other = await entry(people[1], 'Texto exclusivo B', 80);
  assert.equal((await clear(actors[0], '', { csrf: '' })).status, 403);
  assert.equal((await clear(actors[1], '', { csrf: actors[0].csrf })).status, 403);
  assert.equal((await clear(actors[1], `?colaborador_id=${people[0]}`)).status, 400);
  assert.equal((await clear(actors[1], '', { body: { colaborador_id: people[0] } })).status, 400);
  const before = await aggregateReport('2099-12-31');
  const response = await clear(actors[0]);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.eliminadas, 1);
  assert.equal(await models.ConsultaChat.findByPk(first.id), null);
  assert.equal(await models.AgentExecutionLog.count({ where: { consulta_chat_id: first.id } }), 0);
  assert.ok(await models.ConsultaChat.findByPk(other.id));
  assert.deepEqual((await repository.history(people[0], { limit: 20, offset: 0 })).items, []);
  assert.deepEqual(await repository.recentConversationMemory(people[0], 2147483647), []);
  const after = await aggregateReport('2099-12-31');
  assert.deepEqual(after.uso_chatbot, before.uso_chatbot);
  assert.deepEqual(after.temas_chatbot, before.temas_chatbot);
  const metrics = await models.ChatMetricaEliminada.findAll({ where: { fecha: day }, raw: true });
  assert.equal(metrics[0].consultas, 1);
  assert.equal(JSON.stringify(metrics).includes('Texto exclusivo'), false);
  assert.equal(Object.hasOwn(metrics[0], 'colaborador_id'), false);
  assert.equal((await (await clear(actors[0])).json()).data.eliminadas, 0);
  assert.equal((await models.ChatMetricaEliminada.findAll({ where: { fecha: day }, raw: true }))[0].consultas, 1);
});

test('borrado espera el envío en curso y elimina también ese mensaje sin reutilizar contexto', async () => {
  let release, entered;
  const gate = new Promise((resolve) => { release = resolve; });
  const ready = new Promise((resolve) => { entered = resolve; });
  const sending = repository.withConversationLock(people[0], async () => { entered(); await gate; await entry(people[0], 'Mensaje en curso'); });
  await ready;
  let finished = false;
  const deleting = clear(actors[0]).then(async (response) => { assert.equal(response.status, 200); finished = true; });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(finished, false);
  release(); await sending; await deleting;
  assert.equal((await repository.history(people[0], { limit: 20, offset: 0 })).total, 0);
  assert.deepEqual(await repository.recentConversationMemory(people[0], 2147483647), []);
});
