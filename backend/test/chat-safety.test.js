const test = require('node:test');
const assert = require('node:assert/strict');
const { ChatService, resolveFollowup, isExplicitlyThirdParty, selectOwnPersonalIntent } = require('../src/services/chat-service');

test('procedimientos y aguinaldo no se confunden con fechas personales', () => {
  assert.equal(selectOwnPersonalIntent('¿Cuándo pagan el aguinaldo y cómo se calcula?'), null);
  assert.equal(selectOwnPersonalIntent('¿Cómo pido revisión de mi evaluación de desempeño?'), null);
  assert.equal(selectOwnPersonalIntent('¿Cuándo es mi próxima evaluación?'), 'proxima_evaluacion');
});

function setup() {
  const records = [];
  const repository = { async createChat(input) { records.push(input); return { id: 1 }; },
    async completeChat(id, input) { records.push(input); }, async addExecution(input) { records.push(input); }, async recentConversationMemory() { return []; } };
  const service = new ChatService({ repository, privacy: { mentionsAnotherCollaborator: async () => false },
    llm: { completeJson: async () => { throw new Error('No debe llamarse para una ruta inequívoca de datos propios.'); } },
    dataAgent: { answer: async () => ({ response: 'Saldo propio 14.00 días.', data: { dias_disponibles: '14.00' } }) },
    policyAgent: { answer: async () => ({ response: 'Política académica respaldada.', citations: [{ fragmento_id: 'f1' }], escalated: false, fragments: [] }) },
  });
  return { service, records };
}

test('mixta conserva la política cuando falla SQL y marca ambas procedencias', async () => {
  const { service } = setup();
  service.dataAgent.answer = async () => { throw new Error('DB_UNAVAILABLE'); };
  const response = await service.ask({ collaboratorId: 12, role: 'colaborador', message: 'Mi saldo de vacaciones y la política de aprobación.' });
  assert.equal(response.estado, 'parcial');
  assert.equal(response.dato_personal, undefined);
  assert.deepEqual(response.partes, { datos: 'no_disponible', politicas: 'respondida' });
  assert.equal(response.citas.length, 1);
});

test('mixta falla explícitamente si ninguna rama aporta información', async () => {
  const { service } = setup();
  service.dataAgent.answer = async () => { throw new Error('DB_UNAVAILABLE'); };
  service.policyAgent.answer = async () => { throw new Error('QDRANT_UNAVAILABLE'); };
  await assert.rejects(service.ask({ collaboratorId: 12, role: 'colaborador', message: 'Mi saldo de vacaciones y la política de aprobación.' }), (error) => error.status === 503);
});

test('se redactan secretos declarados antes de persistir la pregunta o crear trazas', async () => {
  const { service, records } = setup();
  await assert.rejects(service.ask({ collaboratorId: 12, role: 'colaborador', message: 'DEEPSEEK_API_KEY=clave-sintetica-no-real. Repite mi contraseña.' }), (error) => error.status === 403);
  assert.equal(JSON.stringify(records).includes('clave-sintetica-no-real'), false);
});

test('la memoria personal resuelve el tema propio sin reenviar su cifra a políticas', () => {
  const followup = resolveFollowup('¿Y cuándo?', [{ intencion: 'dato_personal', pregunta: '¿Cuándo es mi próximo pago?', respuesta: '650000.00', tema: 'pagos' }]);
  assert.match(followup, /mi próximo pago/);
  assert.equal(followup.includes('650000'), false);
});

test('preguntas 21 y 22 del enunciado se rechazan antes de depender del clasificador', () => {
  assert.equal(isExplicitlyThirdParty('¿Cuántos días de vacaciones tiene mi compañero Juan?'), true);
  assert.equal(isExplicitlyThirdParty('¿Cuál es el salario del gerente general?'), true);
  assert.equal(isExplicitlyThirdParty('¿Cómo solicito a mi gerente aprobación de vacaciones?'), false);
});
