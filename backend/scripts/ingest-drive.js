#!/usr/bin/env node
require('../src/config/env');
const { IngestionAgent } = require('../src/agents/ingestion-agent');
const { sequelize } = require('../src/models');

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== '--full');
  if (unknown.length) throw new Error('Uso: node scripts/ingest-drive.js [--full]');
  try {
    const result = await new IngestionAgent().sync({ forceFull: args.includes('--full') });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
  } finally { await sequelize.close(); }
}
main().catch((error) => { process.stderr.write(`Ingesta no completada (${String(error.message || 'ERROR').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 80)}).\n`); process.exitCode = 1; });
