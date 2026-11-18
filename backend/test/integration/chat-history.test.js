const test = require('node:test');
const assert = require('node:assert/strict');
const { ConsultaChat, Colaborador, sequelize } = require('../../src/models');
const repository = require('../../src/repositories/personal-chat-repository');
const app = require('../../src/app');
const chatController = require('../../src/controllers/chat-controller');
const { authConfig } = require('../../src/config/auth');

const createdIds = [];
let server;
let base;
const sessions = [];
const originalChat = chatController.chat;
test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  chatController.chat = originalChat;
  if (server) await new Promise((resolve) => server.close(resolve));
  if (sessions.length) await require('../../src/models').Sesion.destroy({ where: { token_hash: sessions } });
  if (createdIds.length) await ConsultaChat.destroy({ where: { id: createdIds } });
  await sequelize.close();
});

async function request(path, { method = 'GET', cookie, csrf, body, headers = {} } = {}) {
  const response = await fetch(`${base}/api/v1${path}`, { method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  return { status: response.status, headers: response.headers, data: text ? JSON.parse(text) : null };
}

test('HTTP /chat exige sesión, Origin, CSRF y esquema; usa colaborador autenticado y el historial rechaza identidad por query', async () => {
  const origin = authConfig().origins[0];
  assert.equal((await request('/chat/historial')).status, 401);
  const login = await request('/auth/login', { method: 'POST', headers: { Origin: origin }, body: {
    email: 'colaborador@bosqueclaro.example', password: process.env.DEMO_COLABORADOR_PASSWORD,
  } });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const token = cookie.slice(authConfig().cookieName.length + 1);
  sessions.push(require('node:crypto').createHash('sha256').update(token).digest('hex'));
  const csrf = login.data.data.csrf_token;
  assert.equal((await request('/chat', { method: 'POST', body: { mensaje: 'consulta' }, headers: { Origin: origin }, cookie })).status, 403);
  assert.equal((await request('/chat', { method: 'POST', csrf, body: { mensaje: 'consulta' }, cookie })).status, 403);
  assert.equal((await request('/chat', { method: 'POST', csrf, body: { mensaje: 'consulta', colaborador_id: 99 }, headers: { Origin: origin }, cookie })).status, 400);
  assert.equal((await request('/chat/historial?colaborador_id=99', { cookie })).status, 400);

  let received;
  chatController.chat = async (req, res) => { received = { collaboratorId: req.auth.data.colaborador.id, message: req.chatMessage };
    res.status(200).json({ data: { consulta_id: 987, intencion: 'politica', respuesta: 'respuesta doble', estado: 'respondida', citas: [], escalada: false } }); };
  const response = await request('/chat', { method: 'POST', headers: { Origin: origin }, cookie, csrf, body: { mensaje: '  ¿Qué dice la política?  ' } });
  assert.equal(response.status, 200);
  assert.equal(received.collaboratorId, login.data.data.colaborador.id);
  assert.equal(received.message, '¿Qué dice la política?');
  chatController.chat = originalChat;
});

test('MySQL persiste respuesta_json y el historial pagina por identidad, excluyendo fixtures', async () => {
  const people = await Colaborador.findAll({ attributes: ['id'], limit: 2, order: [['id', 'ASC']], raw: true });
  assert.equal(people.length, 2);
  const previous = await repository.history(people[0].id, { limit: 1, offset: 0 });
  const first = await ConsultaChat.create({ colaborador_id: people[0].id, pregunta: 'Consulta privada de integración A',
    intencion: 'dato_personal', agente: 'orquestador', origen: 'ejecucion', respuesta_json: { respuesta: 'Respuesta A', estado: 'respondida' },
    documentos_citados: [], creada_en: new Date() });
  createdIds.push(first.id);
  const fixture = await ConsultaChat.create({ colaborador_id: people[0].id, pregunta: 'Fixture que no aparece', intencion: 'politica',
    origen: 'fixture', documentos_citados: [], creada_en: new Date() });
  createdIds.push(fixture.id);
  const other = await ConsultaChat.create({ colaborador_id: people[1].id, pregunta: 'Consulta de otra identidad', intencion: 'dato_personal',
    origen: 'ejecucion', respuesta_json: { respuesta: 'No debe filtrarse', estado: 'respondida' }, documentos_citados: [], creada_en: new Date() });
  createdIds.push(other.id);

  const own = await repository.history(people[0].id, { limit: 1, offset: 0 });
  assert.equal(own.total, previous.total + 1);
  assert.equal(own.items.length, 1);
  assert.equal(own.items[0].mensaje, 'Consulta privada de integración A');
  assert.equal(own.items[0].respuesta, 'Respuesta A');
  assert.equal((await repository.history(people[1].id, { limit: 20, offset: 0 })).items[0].mensaje, 'Consulta de otra identidad');
});
