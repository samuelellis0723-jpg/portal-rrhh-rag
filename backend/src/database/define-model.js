const { DataTypes } = require('sequelize');
const schema = require('./schema-v1.json');

function attributesFor(table) {
  return Object.fromEntries(Object.entries(schema[table].fields).map(([name, field]) => {
    const attribute = structuredClone(field);
    const { type, values } = attribute;
    delete attribute.values;
    if (type === 'enum') attribute.type = DataTypes.ENUM(...values);
    else if (type.startsWith('varchar')) attribute.type = DataTypes.STRING(Number(type.match(/\d+/)[0]));
    else if (type.startsWith('char')) attribute.type = DataTypes.CHAR(Number(type.match(/\d+/)[0]));
    else if (type.startsWith('decimal')) {
      const [precision, scale] = type.match(/\d+/g).map(Number);
      attribute.type = DataTypes.DECIMAL(precision, scale);
    } else attribute.type = {
      int: DataTypes.INTEGER, date: DataTypes.DATEONLY, datetime: DataTypes.DATE,
      boolean: DataTypes.BOOLEAN, text: DataTypes.TEXT, json: DataTypes.JSON,
    }[type];
    if (!attribute.type) throw new Error(`Tipo no soportado en ${table}.${name}`);
    return [name, attribute];
  }));
}

function defineModel(sequelize, name, table) {
  return sequelize.define(name, attributesFor(table), {
    tableName: table,
    timestamps: false,
    indexes: structuredClone(schema[table].indexes),
  });
}

module.exports = { attributesFor, defineModel };
