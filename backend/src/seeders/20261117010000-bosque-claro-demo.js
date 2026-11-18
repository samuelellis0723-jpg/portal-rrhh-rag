const { QueryTypes, Op } = require('sequelize');
const schema = require('../database/schema-v1.json');
const { buildFixtures } = require('../fixtures/bosque-claro');
const { hashPassword, verifyPassword } = require('../services/password-service');

const conflict = () => new Error('SEED_CONFLICT: existen registros coincidentes o modificados; no se sobrescribió ningún dato.');

function normalize(value, type) {
  if (value === null || value === undefined) return value;
  if (type === 'datetime') return new Date(value).toISOString();
  if (type === 'boolean') return Boolean(value);
  if (type.startsWith('decimal')) return Number(value).toFixed(2);
  if (type === 'json') {
    const obj = typeof value === 'string' ? JSON.parse(value) : value;
    const canonical = (v) => Array.isArray(v) ? v.map(canonical)
      : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v;
    return JSON.stringify(canonical(obj));
  }
  return value;
}

async function existingFixture(queryInterface, fixtures, transaction) {
  let found = 0;
  let expected = 0;
  for (const [table, rows] of Object.entries(fixtures)) {
    expected += rows.length;
    const existing = await queryInterface.sequelize.query(`SELECT * FROM \`${table}\` WHERE id IN (:ids)`, {
      replacements: { ids: rows.map((r) => r.id) }, type: QueryTypes.SELECT, transaction,
    });
    found += existing.length;
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const row of existing) {
      const wanted = byId.get(row.id);
      for (const [column, value] of Object.entries(wanted)) {
        if (column === 'password_hash') {
          if (!String(row[column]).startsWith('scrypt$16384$8$1$')) throw conflict();
          continue;
        }
        const type = schema[table].fields[column].type;
        if (normalize(row[column], type) !== normalize(value, type)) throw conflict();
      }
    }
  }
  if (found && found !== expected) throw conflict();
  return found === expected;
}

function prepareRows(table, rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
    schema[table].fields[key].type === 'json' && value !== null ? JSON.stringify(value)
      : schema[table].fields[key].type === 'datetime' && value !== null ? new Date(value) : value,
  ])));
}

module.exports = {
  async up(queryInterface) {
    if ((process.env.NODE_ENV || 'development') === 'production') throw new Error('Seed de demo deshabilitado en producción.');
    const fixtures = buildFixtures();
    await queryInterface.sequelize.transaction(async (transaction) => {
      if (await existingFixture(queryInterface, fixtures, transaction)) return;
      const collisions = await queryInterface.sequelize.query('SELECT id FROM colaboradores WHERE correo IN (:emails)', {
        replacements: { emails: fixtures.colaboradores.map((r) => r.correo) }, type: QueryTypes.SELECT, transaction,
      });
      if (collisions.length) throw conflict();
      const passwords = { rrhh: process.env.DEMO_RRHH_PASSWORD, colaborador: process.env.DEMO_COLABORADOR_PASSWORD };
      if (!passwords.rrhh || !passwords.colaborador) throw new Error('Configura DEMO_RRHH_PASSWORD y DEMO_COLABORADOR_PASSWORD (12–256 caracteres) en backend/.env.');
      if (passwords.rrhh === passwords.colaborador) throw new Error('Usa contraseñas distintas para los dos roles de demo.');
      for (const user of fixtures.usuarios) {
        const person = fixtures.colaboradores.find((p) => p.id === user.colaborador_id);
        user.password_hash = await hashPassword(passwords[person.rol]);
      }
      for (const [table, rows] of Object.entries(fixtures)) {
        const insertRows = table === 'colaboradores' ? rows.map((r) => ({ ...r, jefe_id: null })) : rows;
        await queryInterface.bulkInsert(table, prepareRows(table, insertRows), { transaction });
        if (table === 'colaboradores') {
          for (const person of rows.filter((r) => r.jefe_id)) {
            await queryInterface.bulkUpdate(table, { jefe_id: person.jefe_id }, { id: person.id }, { transaction });
          }
        }
      }
    });
  },
  async down(queryInterface) {
    if ((process.env.NODE_ENV || 'development') === 'production') throw new Error('Reversión de demo deshabilitada en producción.');
    const fixtures = buildFixtures();
    await queryInterface.sequelize.transaction(async (transaction) => {
      if (!(await existingFixture(queryInterface, fixtures, transaction))) return;
      const users = await queryInterface.sequelize.query('SELECT id, password_hash FROM usuarios WHERE id IN (:ids)', {
        replacements: { ids: fixtures.usuarios.map((user) => user.id) }, type: QueryTypes.SELECT, transaction,
      });
      for (const user of users) {
        const password = user.id === fixtures.usuarios[0].id
          ? process.env.DEMO_RRHH_PASSWORD : process.env.DEMO_COLABORADOR_PASSWORD;
        if (!await verifyPassword(password, user.password_hash)) throw conflict();
      }
      // No borrar filas modificadas ni desactivar FK. Si hay sesiones/datos nuevos dependientes, la transacción falla sin borrar nada.
      for (const [table, rows] of Object.entries(fixtures).reverse()) {
        if (table === 'colaboradores') {
          await queryInterface.bulkUpdate(table, { jefe_id: null }, { id: { [Op.in]: rows.map((r) => r.id) } }, { transaction });
        }
        await queryInterface.bulkDelete(table, { id: { [Op.in]: rows.map((r) => r.id) } }, { transaction });
      }
    });
  },
};
