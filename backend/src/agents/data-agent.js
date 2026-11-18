const { ownVacationBalance, ownNextPayment, ownNextEvaluation, ownRequests } = require('../repositories/personal-chat-repository');

function costaRicaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
}
function todayCR(date) { const p = costaRicaDate(date); return `${p.year}-${p.month}-${p.day}`; }

class DataAgent {
  constructor(repository = require('../repositories/personal-chat-repository'), clock = () => new Date()) { this.repository = repository; this.clock = clock; }

  async answer(query, collaboratorId, intent) {
    const date = todayCR(this.clock());
    if (intent === 'saldo_vacaciones') {
      const data = await this.repository.ownVacationBalance(collaboratorId, date);
      return { response: `Tu saldo total de vacaciones disponible es de ${data.dias_disponibles} días al ${date}.`, data };
    }
    if (intent === 'proximo_pago') {
      const data = await this.repository.ownNextPayment(collaboratorId, date);
      return data ? { response: `Tu próximo pago está programado para ${data.fecha_pago} (${data.tipo}).`, data } : { response: 'No hay un pago futuro programado o confirmado registrado.', data: null };
    }
    if (intent === 'proxima_evaluacion') {
      const data = await this.repository.ownNextEvaluation(collaboratorId, date);
      return data ? { response: `Tu próxima evaluación está programada para ${data.fecha_programada}.`, data } : { response: 'No hay una evaluación futura programada registrada.', data: null };
    }
    if (intent === 'solicitudes') {
      const data = await this.repository.ownRequests(collaboratorId, { limit: 20, offset: 0 });
      const pending = data.items.filter((item) => item.estado === 'pendiente').length;
      const details = data.items.slice(0, 5).map((item) => `${item.tipo} del ${item.fecha_inicio} al ${item.fecha_fin}: ${item.estado}`).join('; ');
      const clarification = /\bmi\s+solicitud\b/i.test(query) && !/\b20\d{2}-\d{2}-\d{2}\b/.test(query)
        ? ' Indica la fecha exacta para identificar sin ambigüedad la solicitud; no asumiré a qué viernes te refieres.' : '';
      return { response: `Tienes ${data.total} solicitudes registradas; ${pending} aparecen pendientes en la página más reciente.${details ? ` ${details}.` : ''}${clarification}`, data };
    }
    throw new Error('PERSONAL_INTENT_UNSUPPORTED');
  }

  async report(reportDate, query = '') {
    const report = await this.repository.findReport(reportDate);
    if (!report) {
      const ApiError = require('../services/api-error');
      throw new ApiError(404, 'NOT_FOUND', 'No existe un reporte para la fecha solicitada.');
    }
    const source = report.origen === 'fixture' ? 'fixture simulado, no ejecución de un agente' : 'reporte persistido del agente analista';
    const data = typeof report.datos_json === 'string' ? JSON.parse(report.datos_json) : report.datos_json;
    const vacations = data?.ausencias?.por_tipo?.vacaciones;
    const answer = /\bvacaciones\b/i.test(query) && /\b(?:personas|colaboradores|empleados)\b/i.test(query)
      ? vacations === null || vacations === undefined ? 'La cifra de personas de vacaciones no está disponible en ese reporte.' : `Hay ${vacations} personas de vacaciones según el reporte de esa fecha.`
      : report.resumen_texto;
    return { response: `Este es el ${source} para ${report.fecha}: ${answer}`, data: { fecha: report.fecha, origen: report.origen, url: `/api/v1/rrhh/reportes/${report.fecha}` } };
  }
}

module.exports = { DataAgent, todayCR };
