'use strict';
const { DataTypes } = require('sequelize');
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('chat_metricas_eliminadas', {
      fecha: { type: DataTypes.DATEONLY, allowNull: false, primaryKey: true },
      tema: { type: DataTypes.STRING(100), allowNull: false, primaryKey: true },
      consultas: { type: DataTypes.INTEGER, allowNull: false },
      resueltas: { type: DataTypes.INTEGER, allowNull: false },
      sin_respuesta: { type: DataTypes.INTEGER, allowNull: false },
      latencia_total: { type: DataTypes.DECIMAL(20, 0), allowNull: false },
      latencia_count: { type: DataTypes.INTEGER, allowNull: false },
    }, { engine: 'InnoDB', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
  },
  async down(queryInterface) {
    // Revierte solo la tabla nueva; el contenido eliminado no se puede recuperar.
    await queryInterface.dropTable('chat_metricas_eliminadas');
  },
};
