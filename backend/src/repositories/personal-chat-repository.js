const { Op, QueryTypes } = require('sequelize');
const { sequelize, ConsultaChat, AgentExecutionLog, ReporteDiario } = require('../models');

async function ownVacationBalance(colaboradorId, cutoffDate) {
  const rows = await sequelize.query(`SELECT CAST(COALESCE(SUM(dias_disponibles), 0) AS DECIMAL(16,2)) AS dias_disponibles
    FROM saldos_vacaciones WHERE colaborador_id = :colaboradorId`, {
    replacements: { colaboradorId }, type: QueryTypes.SELECT,
  });
  return { tipo: 'saldo_vacaciones', dias_disponibles: String(rows[0]?.dias_disponibles || '0.00'), fecha_corte: cutoffDate };
}

async function ownNextPayment(colaboradorId, cutoffDate) {
  const rows = await sequelize.query(`SELECT id, fecha_pago, tipo, periodo_inicio, periodo_fin, monto, moneda, estado
    FROM pagos WHERE colaborador_id = :colaboradorId AND fecha_pago >= :cutoffDate
      AND estado IN ('programado','confirmado') ORDER BY fecha_pago ASC, id ASC LIMIT 1`, {
    replacements: { colaboradorId, cutoffDate }, type: QueryTypes.SELECT,
  });
  return rows[0] || null;
}

async function ownNextEvaluation(colaboradorId, cutoffDate) {
  const rows = await sequelize.query(`SELECT id, fecha_programada, tipo, estado FROM evaluaciones
    WHERE colaborador_id = :colaboradorId AND fecha_programada >= :cutoffDate AND estado = 'programada'
    ORDER BY fecha_programada ASC, id ASC LIMIT 1`, {
    replacements: { colaboradorId, cutoffDate }, type: QueryTypes.SELECT,
  });
  return rows[0] || null;
}

async function ownRequests(colaboradorId, { limit, offset }) {
  const rows = await sequelize.query(`SELECT id, tipo, fecha_inicio, fecha_fin, estado, creada_en, resuelta_en
    FROM solicitudes WHERE colaborador_id = :colaboradorId ORDER BY creada_en DESC, id DESC LIMIT :limit OFFSET :offset`, {
    replacements: { colaboradorId, limit, offset }, type: QueryTypes.SELECT,
  });
  const totals = await sequelize.query('SELECT COUNT(*) AS total FROM solicitudes WHERE colaborador_id = :colaboradorId', {
    replacements: { colaboradorId }, type: QueryTypes.SELECT,
  });
  return { items: rows, limit, offset, total: Number(totals[0]?.total || 0) };
}

async function createChat({ colaboradorId, pregunta, creadaEn }) {
  return ConsultaChat.create({ colaborador_id: colaboradorId, pregunta, creada_en: creadaEn, origen: 'ejecucion' });
}

async function completeChat(id, values) { return ConsultaChat.update(values, { where: { id, origen: 'ejecucion' } }); }

async function addExecution(values) { return AgentExecutionLog.create({ tipo_ejecucion: 'chat', origen: 'ejecucion', ...values }); }

async function history(colaboradorId, { limit, offset }) {
  const { count, rows } = await ConsultaChat.findAndCountAll({
    where: { colaborador_id: colaboradorId, origen: 'ejecucion' },
    order: [['creada_en', 'DESC'], ['id', 'DESC']], limit, offset,
  });
  if (!rows.length) return { items: [], limit, offset, total: count };
  return { items: rows.map((row) => {
    const result = row.respuesta_json || {};
    return { consulta_id: row.id, mensaje: row.pregunta, intencion: row.intencion || 'otro', respuesta: result.respuesta || null,
      estado: result.estado || (row.escalada ? 'sin_respaldo' : row.resuelta ? 'respondida' : 'en_proceso'),
      citas: row.documentos_citados || [], ...(result.dato_personal ? { dato_personal: result.dato_personal } : {}),
      ...(result.reporte ? { reporte: result.reporte } : {}),
      ...(result.partes ? { partes: result.partes } : {}),
      escalada: Boolean(row.escalada), creada_en: row.creada_en };
  }), limit, offset, total: count };
}

async function recentConversationMemory(colaboradorId, currentChatId, limit = 5) {
  const rows = await ConsultaChat.findAll({ where: { colaborador_id: colaboradorId, origen: 'ejecucion',
    intencion: { [Op.in]: ['politica', 'dato_personal', 'mixta'] },
    id: { [Op.lt]: currentChatId } }, attributes: ['pregunta', 'intencion', 'tema', 'respuesta_json'],
    order: [['creada_en', 'DESC'], ['id', 'DESC']], limit: Math.min(5, Math.max(1, limit)), raw: true });
  return rows.filter((row) => row.respuesta_json?.estado !== 'error').map((row) => ({
    pregunta: String(row.pregunta).slice(0, 1000), intencion: row.intencion, tema: safeTopic(row.tema),
    // Una respuesta personal o mixta nunca se vuelve contexto del agente de políticas.
    respuesta: row.intencion === 'politica' ? String(row.respuesta_json?.respuesta || '').slice(0, 600) : '',
  }));
}

async function recentPolicyMemory(colaboradorId, currentChatId, limit = 5) {
  const rows = await ConsultaChat.findAll({ where: { colaborador_id: colaboradorId, origen: 'ejecucion', intencion: 'politica',
    ...(currentChatId ? { id: { [Op.ne]: currentChatId } } : {}) },
  attributes: ['pregunta', 'tema', 'respuesta_json'], order: [['creada_en', 'DESC'], ['id', 'DESC']], limit: Math.min(Math.max(limit, 1), 5), raw: true });
  return rows.map(({ pregunta, tema, respuesta_json }) => ({ pregunta: String(pregunta).replace(/\b\d+(?:[.,]\d+)*\b/g, '[dato omitido]').slice(0, 1000),
    tema: safeTopic(tema), respuesta: String(respuesta_json?.respuesta || '').slice(0, 600) }));
}

async function findReport(reportDate) {
  return ReporteDiario.findOne({ where: { fecha: reportDate }, attributes: ['fecha', 'datos_json', 'resumen_texto', 'origen', 'generado_en'] });
}

function safeTopic(topic) { return ['vacaciones','solicitudes','pagos','evaluaciones','politicas','otro'].includes(topic) ? topic : 'otro'; }

module.exports = { ownVacationBalance, ownNextPayment, ownNextEvaluation, ownRequests, findReport, createChat, completeChat, addExecution, history, recentPolicyMemory, recentConversationMemory };
