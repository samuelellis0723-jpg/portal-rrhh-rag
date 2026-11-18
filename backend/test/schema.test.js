const test = require('node:test');
const assert = require('node:assert/strict');
const { literal } = require('sequelize');
const { sequelize } = require('../src/models');
const schema = require('../src/database/current-schema');

test.after(() => sequelize.close());

test('14 modelos reflejan todos los atributos, sin timestamps automáticos extra', () => {
  assert.equal(Object.keys(sequelize.models).length, 14);
  for (const model of Object.values(sequelize.models)) {
    assert.deepEqual(Object.keys(model.rawAttributes).sort(), Object.keys(schema[model.tableName].fields).sort());
    for (const [name, field] of Object.entries(schema[model.tableName].fields)) {
      assert.equal(model.rawAttributes[name].allowNull, field.allowNull);
    }
  }
});

test('todos los CHECK producen SQL MySQL con los campos requeridos por Sequelize', () => {
  const generator = sequelize.getQueryInterface().queryGenerator;
  for (const [table, spec] of Object.entries(schema)) for (const expression of spec.checks) {
    const sql = generator.addConstraintQuery(table, {
      fields: Object.keys(spec.fields).filter((field) => new RegExp(`\\b${field}\\b`).test(expression)),
      type: 'check', name: `${table}_test_check`, where: literal(expression),
    });
    assert.ok(sql.includes('CHECK'));
    assert.ok(sql.includes(expression));
  }
});
