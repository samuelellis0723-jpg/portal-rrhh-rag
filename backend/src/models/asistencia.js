const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Asistencia', {
  id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
  colaborador_id: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: 'colaboradores', key: 'id' },
    onDelete: 'RESTRICT', onUpdate: 'RESTRICT',
  },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  es_dia_programado: { type: DataTypes.BOOLEAN, allowNull: false },
  hora_entrada_programada: { type: DataTypes.STRING(8), allowNull: true },
  hora_entrada_real: { type: DataTypes.STRING(8), allowNull: true },
  minutos_tardia: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  estado: {
    type: DataTypes.ENUM('puntual', 'tardia', 'falta', 'vacaciones', 'permiso', 'incapacidad', 'dia_libre', 'sin_registro'),
    allowNull: false,
  },
  origen: { type: DataTypes.ENUM('simulado', 'ejecucion'), allowNull: false, defaultValue: 'simulado' },
}, {
  tableName: 'asistencias',
  timestamps: false,
  indexes: [
    { name: 'uq_asistencias_colaborador_fecha', unique: true, fields: ['colaborador_id', 'fecha'] },
    { name: 'idx_asistencias_fecha_estado', unique: false, fields: ['fecha', 'estado'] },
  ],
});
