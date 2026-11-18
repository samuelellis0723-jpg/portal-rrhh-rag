const { createDailyWorker, safeErrorCode } = require('../src/jobs/report-scheduler');
const { generateDailyReport, repository } = require('../src/services/report-service');

const worker = createDailyWorker({
  reportTask: (date) => generateDailyReport(date),
  // Se instancia solo cuando la tarea vence, así los errores de Drive no impiden programar reportes.
  ingestionTask: async () => {
    const { IngestionAgent } = require('../src/agents/ingestion-agent');
    return new IngestionAgent().sync();
  },
  onError: (task, error) => console.error(`${task} falló (${safeErrorCode(error)}); se reintentará.`),
});

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Worker detenido por ${signal}.`);
  await worker.stop();
  await repository.sequelize.close();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

worker.start().then(() => {
  if (!stopping) console.log('Worker Bosque Claro activo; reportes 07:00 e ingesta diaria en America/Costa_Rica.');
}).catch(async (error) => {
  console.error(`No inició el worker (${safeErrorCode(error)}).`);
  await shutdown('startup-error');
  process.exitCode = 1;
});
