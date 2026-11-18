const test = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize, QueryTypes } = require('sequelize');
const { databaseOptions } = require('../../src/config/database-options');
const models = require('../../src/models');
const seeder = require('../../src/seeders/20261117010000-bosque-claro-demo');
const { BASE, buildFixtures } = require('../../src/fixtures/bosque-claro');
const app = require('../../src/app');

const migration = new Sequelize(databaseOptions(process.env.NODE_ENV || 'development', true));
test.after(async () => { await migration.close(); await models.sequelize.close(); });

test('MySQL aplica CHECK y FK; las transacciones de prueba no dejan datos', async () => {
  const transaction = await migration.transaction();
  try {
    await assert.rejects(migration.query('UPDATE saldos_vacaciones SET dias_disponibles = -1 WHERE id = :id', {
      replacements: { id: BASE + 1 }, transaction,
    }), (error) => error.original.code === 'ER_CHECK_CONSTRAINT_VIOLATED');
    await assert.rejects(migration.query('UPDATE usuarios SET colaborador_id = -1 WHERE id = :id', {
      replacements: { id: BASE + 1 }, transaction,
    }), (error) => error.original.code === 'ER_NO_REFERENCED_ROW_2');
    await assert.rejects(migration.query('UPDATE colaboradores SET correo = :email WHERE id = :id', {
      replacements: { email: 'rrhh@bosqueclaro.example', id: BASE + 2 }, transaction,
    }), (error) => error.original.code === 'ER_DUP_ENTRY');
  } finally { await transaction.rollback(); }
});

test('seed repetido conserva registros y rechaza colisiones sin sobrescribir', async () => {
  const fixtures = buildFixtures();
  await seeder.up(migration.getQueryInterface());
  for (const [table, records] of Object.entries(fixtures)) {
    const [row] = await migration.query(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE id IN (:ids)`, {
      replacements: { ids: records.map((r) => r.id) }, type: QueryTypes.SELECT,
    });
    assert.equal(Number(row.n), records.length);
  }
  // Alteración de snapshot aislada: el seeder no deberá corregirla por su cuenta.
  const original = fixtures.colaboradores[1].nombre;
  try {
    await migration.query('UPDATE colaboradores SET nombre = :name WHERE id = :id', {
      replacements: { name: 'Registro cambiado por prueba', id: BASE + 2 },
    });
    await assert.rejects(seeder.up(migration.getQueryInterface()), /SEED_CONFLICT/);
    const [row] = await migration.query('SELECT nombre FROM colaboradores WHERE id = :id', {
      replacements: { id: BASE + 2 }, type: QueryTypes.SELECT,
    });
    assert.equal(row.nombre, 'Registro cambiado por prueba');
  } finally {
    await migration.query('UPDATE colaboradores SET nombre = :name WHERE id = :id', {
      replacements: { name: original, id: BASE + 2 },
    });
  }
});

test('salud HTTP comprueba MySQL y no filtra errores; sesión anónima devuelve 401', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    let response = await fetch(`${url}/api/v1/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { status: 'ok', database: 'up' } });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    response = await fetch(`${url}/api/v1/auth/session`);
    assert.equal(response.status, 401);
    const authenticate = models.sequelize.authenticate;
    try {
      models.sequelize.authenticate = async () => { throw new Error('SQL con contraseña que no debe salir'); };
      response = await fetch(`${url}/api/v1/health`);
      assert.equal(response.status, 503);
      assert.equal((await response.text()).includes('contraseña'), false);
    } finally { models.sequelize.authenticate = authenticate; }
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
