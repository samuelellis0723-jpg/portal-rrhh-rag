const test = require('node:test');
const assert = require('node:assert/strict');
const { AnalystAgent, validateBusinessDate, reportFacts, validateSummary } = require('../src/agents/analyst-agent');

const data = {
  ausencias: { disponible: true, total: 5, por_tipo: { vacaciones: 3, permiso: 1, incapacidad: 1 } },
  solicitudes_pendientes: { total: 4, mas_de_3_dias: 2 },
  incapacidades: { activas: 1, dias_acumulados_mes: 3 },
  movimientos_personal: { disponible: true, ingresos_mes: 1, salidas_mes: 0, rotacion_acumulada_pct: 0,
    dotacion_inicio_mes: 58, dotacion_corte: 59 },
  riesgo_vacaciones: { disponible: true, umbral_dias: 20, total_colaboradores: 2 },
  uso_chatbot: { consultas_dia_anterior: 8, resueltas_sin_escalar_pct: 75, latencia_promedio_ms: 180 },
  temas_chatbot: { top_5: [{ tema: 'vacaciones', consultas: 6 }], sin_respuesta: [{ pregunta: 'Consulta sin respuesta sobre otros.', consultas: 2 }] },
};

test('fecha de negocio rechaza fechas imposibles', () => {
  assert.equal(validateBusinessDate('2026-11-18'), '2026-11-18');
  for (const value of ['2026-02-30', '18-11-2026', '', null]) assert.throws(() => validateBusinessDate(value), /REPORT_DATE_INVALID/);
});

test('el analista usa agregados SQL y redacta un resumen validado sin cifras inventadas', async () => {
  let seen;
  const agent = new AnalystAgent({ repository: { aggregateReport: async (date) => { seen = date; return structuredClone(data); } },
    llm: { completeJson: async ({ user }) => {
      const facts = JSON.parse(user).hechos;
      assert.equal(facts.ausencias.total, 5);
      assert.equal('items' in facts.solicitudes_pendientes, false);
      return { indices: [0, 1, 6] };
    } }, clock: () => new Date('2026-11-18T13:00:00.000Z') });
  const result = await agent.generate('2026-11-18');
  assert.equal(seen, '2026-11-18');
  assert.equal(result.data.resumen_ejecutivo, result.summary);
  assert.equal(result.generatedAt.toISOString(), '2026-11-18T13:00:00.000Z');
});

test('validador rechaza cantidad de frases incorrecta y cifras fuera del JSON', () => {
  const facts = reportFacts(data);
  assert.throws(() => validateSummary('Hay 5 ausencias. Se observan 4 pendientes.', facts), /REPORT_SUMMARY_INVALID/);
  assert.throws(() => validateSummary('Hay 99 ausencias. Se registran 4 solicitudes pendientes. El chat recibió 8 consultas.', facts), /REPORT_SUMMARY_NUMERIC_MISMATCH/);
  assert.equal(validateSummary('Hay 5 ausencias. Se registran 4 solicitudes. El chat recibió 8 consultas.', facts).split('.').length, 4);
});

test('el LLM no puede sustituir cifras ni inyectar frases en el resumen', async () => {
  for (const selection of [{ indices: [0, 0, 1] }, { indices: [0, 1, 99] }, { indices: [0, 1, 'Hay 99 ausencias.'] }]) {
    const agent = new AnalystAgent({ llm: { completeJson: async () => selection } });
    await assert.rejects(agent.summarize(data), /REPORT_SUMMARY_INVALID/);
  }
});
