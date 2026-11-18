const { literal, QueryTypes } = require('sequelize');
const schema = require('../../database/schema-v1.json');
const { attributesFor } = require('../../database/define-model');

// Estos helpers y schema-v1 son snapshots inmutables. Cambios futuros requieren otra migración.
function migrationFor(table) {
  return {
    async up(queryInterface) {
      const marker = `bosque_claro_schema_v1:${table}`;
      const existing = await queryInterface.sequelize.query(
        'SELECT TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table',
        { replacements: { table }, type: QueryTypes.SELECT },
      );
      if (existing.length) {
        if (existing[0].TABLE_COMMENT !== marker) throw new Error(`SCHEMA_CONFLICT: ${table} preexistente sin marca de esta migración; no se modificó.`);
        const columns = await queryInterface.describeTable(table);
        if (Object.keys(columns).sort().join() !== Object.keys(schema[table].fields).sort().join()) {
          throw new Error(`SCHEMA_CONFLICT: columnas distintas en ${table}.`);
        }
      } else {
        await queryInterface.createTable(table, attributesFor(table), {
          engine: 'InnoDB', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', comment: marker,
        });
      }
      const existingIndexes = await queryInterface.showIndex(table);
      for (const index of schema[table].indexes) {
        const found = existingIndexes.find((entry) => entry.name === index.name);
        if (found) {
          if (found.unique !== index.unique || found.fields.map((f) => f.attribute).join() !== index.fields.join()) {
            throw new Error(`SCHEMA_CONFLICT: índice distinto en ${table}.`);
          }
          continue;
        }
        await queryInterface.addIndex(table, index.fields, { name: index.name, unique: index.unique });
      }
      const constraints = await queryInterface.sequelize.query(
        'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND CONSTRAINT_TYPE = :type',
        { replacements: { table, type: 'CHECK' }, type: QueryTypes.SELECT },
      );
      for (const [i, expression] of schema[table].checks.entries()) {
        const name = `${table}_check_${i + 1}`;
        if (constraints.some((constraint) => constraint.CONSTRAINT_NAME === name)) continue;
        await queryInterface.addConstraint(table, {
          fields: Object.keys(schema[table].fields).filter((field) => new RegExp(`\\b${field}\\b`).test(expression)),
          type: 'check', name, where: literal(expression),
        });
      }
    },
    async down(queryInterface) {
      await queryInterface.dropTable(table);
    },
  };
}

module.exports = { migrationFor };
