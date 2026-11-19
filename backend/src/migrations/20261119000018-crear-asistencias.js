'use strict';
const { DataTypes, literal } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('asistencias', {
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
    }, { engine: 'InnoDB', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.addIndex('asistencias', ['colaborador_id', 'fecha'], {
      name: 'uq_asistencias_colaborador_fecha', unique: true,
    });
    await queryInterface.addIndex('asistencias', ['fecha', 'estado'], {
      name: 'idx_asistencias_fecha_estado', unique: false,
    });
    await queryInterface.addConstraint('asistencias', {
      fields: ['minutos_tardia'],
      type: 'check',
      name: 'chk_asistencias_tardia_no_negativa',
      where: literal('minutos_tardia >= 0'),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asistencias');
  },
};
