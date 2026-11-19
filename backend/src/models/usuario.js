const { defineModel } = require('../database/define-model');
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const model = defineModel(sequelize, 'Usuario', 'usuarios');
  model.rawAttributes.nombres = { type: DataTypes.STRING(160), allowNull: false, defaultValue: '' };
  model.refreshAttributes();
  return model;
};
