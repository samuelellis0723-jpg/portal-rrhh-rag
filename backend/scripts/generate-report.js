const { businessDate } = require('../src/jobs/report-scheduler');
const { generateDailyReport, repository } = require('../src/services/report-service');

async function main(argv = process.argv.slice(2)) {
  if (argv.length > 1 || (argv[0] && !/^\d{4}-\d{2}-\d{2}$/.test(argv[0]))) {
    throw new Error('Uso: node scripts/generate-report.js [YYYY-MM-DD]');
  }
  const date = argv[0] || businessDate();
  const result = await generateDailyReport(date);
  console.log(JSON.stringify({ fecha: date, estado: result.status, origen: result.report?.origen || null }));
  if (result.status === 'busy') process.exitCode = 2;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`No se generó el reporte: ${String(error.code || error.message || 'ERROR').replace(/[^A-Za-z0-9_ -]/g, '').slice(0, 120)}`);
    process.exitCode = 1;
  }).finally(() => repository.sequelize.close());
}

module.exports = { main };
