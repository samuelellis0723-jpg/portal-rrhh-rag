'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('consultas_chat', 'respuesta_json', { type: DataTypes.JSON, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('consultas_chat', 'respuesta_json');
  },
};
