const { defineModel } = require('../database/define-model');
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const model = defineModel(sequelize, 'ConsultaChat', 'consultas_chat');
  model.rawAttributes.respuesta_json = { type: DataTypes.JSON, allowNull: true };
  model.refreshAttributes();
  return model;
};
