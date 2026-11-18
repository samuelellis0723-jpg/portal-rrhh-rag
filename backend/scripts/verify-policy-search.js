const fs = require('node:fs/promises');
const path = require('node:path');
require('../src/config/env');
const { IngestionAgent } = require('../src/agents/ingestion-agent');
const { sequelize } = require('../src/models');

function citationIsTraceable(result) {
  if (!result.drive_file_id || !result.documento || !result.seccion || !result.version || !result.fragmento_id) return false;
  try {
    const url = new URL(result.enlace);
    return url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname)
      && (url.pathname.includes(result.drive_file_id) || url.searchParams.get('id') === result.drive_file_id);
  } catch { return false; }
}

async function main() {
  const agent = new IngestionAgent();
  const cases = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../docs/politicas/consultas-ingesta.json'), 'utf8'));
  const checks = [];
  for (const entry of cases) {
    const results = await agent.search(entry.pregunta, 5);
    const traceable = results.length > 0 && results.every(citationIsTraceable);
    const expectedFound = results.some((result) => result.external_document_id === entry.documento_esperado);
    checks.push({ pregunta: entry.pregunta, documento_esperado: entry.documento_esperado,
      expected_in_top_5: expectedFound, traceable,
      citas: results.map(({ documento, seccion, version, enlace, drive_file_id, fragmento_id, score }) =>
        ({ documento, seccion, version, enlace, drive_file_id, fragmento_id, score })) });
  }
  const passed = checks.every((check) => check.expected_in_top_5 && check.traceable);
  console.log(JSON.stringify({ real_services: true, passed, checks,
    note: 'Verifica recuperación y estructura de enlaces. Abrirlos en el navegador con un usuario autorizado sigue siendo una comprobación manual.' }, null, 2));
  if (!passed) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(() => {
    console.error(JSON.stringify({ real_services: false, verified: false, error: 'SEMANTIC_VERIFICATION_NOT_COMPLETED',
      action: 'Revisa ingest:check -- --live y completa primero ingest:sync. No se usaron resultados de relleno.' }));
    process.exitCode = 1;
  }).finally(() => sequelize.close());
}

module.exports = { citationIsTraceable };
