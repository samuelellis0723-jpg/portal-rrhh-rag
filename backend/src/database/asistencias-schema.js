// Registros diarios de jornada y asistencia en zona horaria America/Costa_Rica.
module.exports = {
  fields: {
    id: { type: 'int', allowNull: false, primaryKey: true, autoIncrement: true },
    colaborador_id: {
      type: 'int', allowNull: false,
      references: { model: 'colaboradores', key: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'RESTRICT',
    },
    fecha: { type: 'date', allowNull: false },
    es_dia_programado: { type: 'boolean', allowNull: false },
    hora_entrada_programada: { type: 'varchar(8)', allowNull: true },
    hora_entrada_real: { type: 'varchar(8)', allowNull: true },
    minutos_tardia: { type: 'int', allowNull: false, defaultValue: 0 },
    estado: {
      type: 'enum', allowNull: false,
      values: ['puntual', 'tardia', 'falta', 'vacaciones', 'permiso', 'incapacidad', 'dia_libre', 'sin_registro'],
    },
    origen: { type: 'enum', allowNull: false, values: ['simulado', 'ejecucion'], defaultValue: 'simulado' },
  },
  indexes: [
    { name: 'uq_asistencias_colaborador_fecha', unique: true, fields: ['colaborador_id', 'fecha'] },
    { name: 'idx_asistencias_fecha_estado', unique: false, fields: ['fecha', 'estado'] },
  ],
  checks: ['minutos_tardia >= 0'],
};
