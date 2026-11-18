const { DeepSeekClient } = require('../integrations/deepseek');
const reportRepository = require('../repositories/report-repository');

const CR_OFFSET = '-06:00';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateBusinessDate(date) {
  if (typeof date !== 'string' || !DATE_RE.test(date)) throw new Error('REPORT_DATE_INVALID');
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('REPORT_DATE_INVALID');
  return date;
}

function reportFacts(data) {
  return {
    ausencias: data.ausencias,
    solicitudes_pendientes: data.solicitudes_pendientes && {
      total: data.solicitudes_pendientes.total, mas_de_3_dias: data.solicitudes_pendientes.mas_de_3_dias,
    },
    incapacidades: data.incapacidades,
    movimientos_personal: data.movimientos_personal && {
      ingresos_mes: data.movimientos_personal.ingresos_mes, salidas_mes: data.movimientos_personal.salidas_mes,
      rotacion_acumulada_pct: data.movimientos_personal.rotacion_acumulada_pct,
      dotacion_inicio_mes: data.movimientos_personal.dotacion_inicio_mes, dotacion_corte: data.movimientos_personal.dotacion_corte,
    },
    riesgo_vacaciones: data.riesgo_vacaciones && {
      umbral_dias: data.riesgo_vacaciones.umbral_dias, total_colaboradores: data.riesgo_vacaciones.total_colaboradores,
    },
    uso_chatbot: data.uso_chatbot && {
      consultas_dia_anterior: data.uso_chatbot.consultas_dia_anterior,
      resueltas_sin_escalar_pct: data.uso_chatbot.resueltas_sin_escalar_pct,
      latencia_promedio_ms: data.uso_chatbot.latencia_promedio_ms,
    },
    temas_chatbot: data.temas_chatbot,
  };
}

function numericValues(value, set = new Set()) {
  if (typeof value === 'number' && Number.isFinite(value)) set.add(value);
  else if (Array.isArray(value)) for (const item of value) numericValues(item, set);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) numericValues(item, set);
  return set;
}

function validateSummary(summary, facts) {
  const text = String(summary || '').trim().replace(/^['"“”]+|['"“”]+$/g, '');
  const sentences = text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/gu)?.map((item) => item.trim()).filter(Boolean) || [];
  if (sentences.length < 3 || sentences.length > 5 || text.length > 1600) throw new Error('REPORT_SUMMARY_INVALID');
  const allowed = numericValues(facts);
  const numbers = text.match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
  for (const number of numbers) {
    const value = Number(number.replace('%', '').replace(',', '.'));
    if (!Number.isFinite(value) || !allowed.has(value)) throw new Error('REPORT_SUMMARY_NUMERIC_MISMATCH');
  }
  return text;
}

function summaryCandidates(data) {
  const a = data.ausencias, p = data.solicitudes_pendientes, i = data.incapacidades;
  const m = data.movimientos_personal, r = data.riesgo_vacaciones, c = data.uso_chatbot;
  return [
    a.total === null ? 'No hay una cifra confiable de ausencias.' : `Hay ${a.total} personas ausentes al corte.`,
    `Hay ${p.total} solicitudes pendientes, de las cuales ${p.mas_de_3_dias} superan el plazo de atención indicado.`,
    `Hay ${i.activas} incapacidades activas y ${i.dias_acumulados_mes} días de incapacidad acumulados en el mes.`,
    `En el mes se registran ${m.ingresos_mes} ingresos y ${m.salidas_mes} salidas.`,
    m.rotacion_acumulada_pct === null ? 'La rotación no cuenta con una dotación confiable para su cálculo.' : `La rotación acumulada del mes es ${m.rotacion_acumulada_pct}%.`,
    r.total_colaboradores === null ? 'No hay una cifra confiable de riesgo de vacaciones.' : `Hay ${r.total_colaboradores} personas con más de ${r.umbral_dias} días disponibles de vacaciones.`,
    c.consultas_dia_anterior === null ? 'No hay registro confiable de consultas del día anterior.' : `El asistente recibió ${c.consultas_dia_anterior} consultas el día anterior.`,
    c.resueltas_sin_escalar_pct === null ? 'No está disponible el porcentaje de resolución del asistente.' : `El asistente resolvió sin escalar el ${c.resueltas_sin_escalar_pct}% de las consultas del día anterior.`,
  ];
}

class AnalystAgent {
  constructor({ repository = reportRepository, llm, clock = () => new Date() } = {}) {
    this.repository = repository;
    this.llm = llm || new DeepSeekClient();
    this.clock = clock;
  }

  async buildReportData(date) {
    return this.repository.aggregateReport(validateBusinessDate(date));
  }

  async summarize(data) {
    const facts = reportFacts(data);
    const candidates = summaryCandidates(data);
    const selection = await this.llm.completeJson({
      system: 'Selecciona de 3 a 5 frases para un resumen ejecutivo equilibrado en español. Las frases son hechos calculados por SQL y no se pueden modificar. Devuelve solo JSON con la propiedad indices, un array de enteros distintos que identifican las frases seleccionadas. No agregues texto ni cifras. Prioriza ausencias, pendientes y riesgos; evita redundancia.',
      user: JSON.stringify({ hechos: facts, frases: candidates.map((texto, indice) => ({ indice, texto })) }), maxTokens: 120,
    });
    const indices = selection?.indices;
    if (!Array.isArray(indices) || indices.length < 3 || indices.length > 5 || new Set(indices).size !== indices.length
      || indices.some((index) => !Number.isInteger(index) || index < 0 || index >= candidates.length)) throw new Error('REPORT_SUMMARY_INVALID');
    // El proveedor elige énfasis; el servidor conserva exactamente la asociación entre métrica y cifra.
    return validateSummary(indices.map((index) => candidates[index]).join(' '), facts);
  }

  async generate(date) {
    const reportDate = validateBusinessDate(date);
    const data = await this.buildReportData(reportDate);
    const summary = await this.summarize(data);
    data.resumen_ejecutivo = summary;
    const generatedAt = this.clock();
    return { date: reportDate, data, summary, generatedAt };
  }
}

module.exports = { AnalystAgent, validateBusinessDate, reportFacts, validateSummary, numericValues, summaryCandidates };
