const { AnalystAgent, validateBusinessDate } = require('../agents/analyst-agent');
const repository = require('../repositories/report-repository');

async function generateDailyReport(date, { agent, store = repository, update = false } = {}) {
  const reportDate = validateBusinessDate(date);
  const locked = await store.withDateLock(reportDate, async () => {
    const existing = await store.findByDate(reportDate);
    if (existing && !update) return { status: 'exists', report: existing };
    const startedAt = new Date();
    try {
      const prepared = await (agent || new AnalystAgent()).generate(reportDate);
      if (existing && update) {
        const report = await store.updateExecution(existing.id, {
          data: prepared.data, summary: prepared.summary, generatedAt: prepared.generatedAt,
        });
        if (store.logAnalystExecution) await store.logAnalystExecution({ startedAt, finishedAt: new Date(),
          state: 'completada', context: { fecha_reporte: reportDate, actualizacion: true } }).catch(() => {});
        return { status: 'updated', report };
      }
      const report = await store.createExecution({
        date: prepared.date, data: prepared.data, summary: prepared.summary, generatedAt: prepared.generatedAt,
      });
      if (store.logAnalystExecution) await store.logAnalystExecution({ startedAt, finishedAt: new Date(),
        state: 'completada', context: { fecha_reporte: reportDate } }).catch(() => {});
      return { status: 'created', report };
    } catch (error) {
      // A non-cooperating writer may race the lock. Preserve its report and never overwrite fixtures.
      if (!update && error.name === 'SequelizeUniqueConstraintError') {
        const report = await store.findByDate(reportDate);
        if (report) return { status: 'exists', report };
      }
      if (store.logAnalystExecution) await store.logAnalystExecution({ startedAt, finishedAt: new Date(),
        state: 'fallida', errorCode: safeErrorCode(error), context: { fecha_reporte: reportDate, actualizacion: Boolean(existing && update) } }).catch(() => {});
      throw error;
    }
  });
  if (!locked.acquired) return { status: 'busy', date: reportDate };
  return locked.result;
}

function safeErrorCode(error) {
  return String(error?.code || error?.message || 'REPORT_GENERATION_ERROR').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 80);
}

async function buildReportData(date, { store = repository } = {}) {
  return store.aggregateReport(validateBusinessDate(date));
}

module.exports = { generateDailyReport, buildReportData, aggregateReport: repository.aggregateReport, repository };
