const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('ChatMetricaEliminada', {
  fecha: { type: DataTypes.DATEONLY, allowNull: false, primaryKey: true },
  tema: { type: DataTypes.STRING(100), allowNull: false, primaryKey: true },
  consultas: { type: DataTypes.INTEGER, allowNull: false },
  resueltas: { type: DataTypes.INTEGER, allowNull: false },
  sin_respuesta: { type: DataTypes.INTEGER, allowNull: false },
  latencia_total: { type: DataTypes.DECIMAL(20, 0), allowNull: false },
  latencia_count: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'chat_metricas_eliminadas', timestamps: false });
