#!/usr/bin/env node
require('../src/config/env');
const { IngestionAgent } = require('../src/agents/ingestion-agent');
const { sequelize } = require('../src/models');

async function main() {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query || query.length > 1000) throw new Error('Uso: node scripts/search-policies.js "pregunta en español"');
  try {
    const results = await new IngestionAgent().search(query, 5);
    process.stdout.write(`${JSON.stringify({ query, results: results.map(({ score, documento, seccion, version, enlace, drive_file_id, fragmento_id, texto }) =>
      ({ score, documento, seccion, version, enlace, drive_file_id, fragmento_id, texto })) }, null, 2)}\n`);
  } finally { await sequelize.close(); }
}
main().catch((error) => { process.stderr.write(`Búsqueda no disponible (${String(error.message || 'ERROR').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 80)}).\n`); process.exitCode = 1; });
