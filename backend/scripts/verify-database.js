const assert = require('node:assert/strict');
const { QueryTypes } = require('sequelize');
const models = require('../src/models');
const schema = require('../src/database/current-schema');
const fs = require('node:fs');
const path = require('node:path');
const { buildFixtures, START, END } = require('../src/fixtures/bosque-claro');
const { verifyPassword } = require('../src/services/password-service');

async function main() {
  const fixtures = buildFixtures();
  const counts = {};
  await models.sequelize.authenticate();
  for (const [table, definition] of Object.entries(schema)) {
    const columns = await models.sequelize.getQueryInterface().describeTable(table);
    assert.deepEqual(Object.keys(columns).sort(), Object.keys(definition.fields).sort());
    const indexes = await models.sequelize.getQueryInterface().showIndex(table);
    for (const index of definition.indexes) {
      const found = indexes.find((i) => i.name === index.name);
      assert.ok(found, `${table}: índice ausente`);
      assert.equal(found.unique, index.unique);
      assert.deepEqual(found.fields.map((f) => f.attribute), index.fields);
    }
    const checks = await models.sequelize.query(
      "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND CONSTRAINT_TYPE = 'CHECK'",
      { replacements: { table }, type: QueryTypes.SELECT },
    );
    assert.equal(checks.length, definition.checks.length, `${table}: CHECK ausente`);
    if (fixtures[table]) {
      const [row] = await models.sequelize.query(`SELECT COUNT(*) AS total FROM \`${table}\` WHERE id IN (:ids)`, {
        replacements: { ids: fixtures[table].map((r) => r.id) }, type: QueryTypes.SELECT,
      });
      assert.equal(Number(row.total), fixtures[table].length, `${table}: fixture incompleto`);
      counts[table] = Number(row.total);
    }
  }
  const migrations = await models.sequelize.query('SELECT name FROM SequelizeMeta', { type: QueryTypes.SELECT });
  const expectedMigrations = fs.readdirSync(path.resolve(__dirname, '../src/migrations')).filter((file) => /^\d+.*\.js$/.test(file)).sort();
  assert.deepEqual(migrations.map((row) => row.name).sort(), expectedMigrations);
  const invalid = await models.SaldoVacaciones.count({ where: models.sequelize.literal('dias_disponibles <> dias_asignados - dias_tomados') });
  assert.equal(invalid, 0);
  for (const [email, role, key] of [
    ['colaborador@bosqueclaro.example', 'colaborador', 'DEMO_COLABORADOR_PASSWORD'],
    ['rrhh@bosqueclaro.example', 'rrhh', 'DEMO_RRHH_PASSWORD'],
  ]) {
    const person = await models.Colaborador.findOne({ where: { correo: email }, include: [{ model: models.Usuario, as: 'usuario' }] });
    assert.ok(person);
    assert.equal(person.rol, role);
    assert.ok(await verifyPassword(process.env[key], person.usuario.password_hash));
  }
  const reports = await models.ReporteDiario.findAll({ where: { origen: 'fixture', generado_por: 'fixture_sin_llm' } });
  for (const report of reports) {
    const data = typeof report.datos_json === 'string' ? JSON.parse(report.datos_json) : report.datos_json;
    assert.equal(Object.keys(data).length, 8);
    assert.equal(data.resumen_ejecutivo, report.resumen_texto);
    assert.equal(data.uso_chatbot.tendencia_30_dias.length, 30);
  }
  const [fk] = await models.sequelize.query(
    "SELECT COUNT(*) AS total FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL",
    { type: QueryTypes.SELECT },
  );
  assert.equal(Number(fk.total), 12);
  console.log(JSON.stringify({ connection: 'up', models: 14, migrations: migrations.length, foreign_keys: Number(fk.total),
    fixture_window: { from: START, to: END }, fixture_counts: counts, demo_password_hashes_verified: true }, null, 2));
}

main().catch(() => {
  console.error('Verificación fallida: revisar migraciones, seed y configuración; no se imprimieron datos ni secretos.');
  process.exitCode = 1;
}).finally(() => models.sequelize.close());
