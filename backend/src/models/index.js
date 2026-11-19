const sequelize = require('../config/database');
const models = {
  Colaborador: require('./colaborador')(sequelize),
  Usuario: require('./usuario')(sequelize),
  Sesion: require('./sesion')(sequelize),
  SaldoVacaciones: require('./saldo-vacaciones')(sequelize),
  Solicitud: require('./solicitud')(sequelize),
  Incapacidad: require('./incapacidad')(sequelize),
  MovimientoPersonal: require('./movimiento-personal')(sequelize),
  Pago: require('./pago')(sequelize),
  Evaluacion: require('./evaluacion')(sequelize),
  ConsultaChat: require('./consulta-chat')(sequelize),
  ChatMetricaEliminada: require('./chat-metrica-eliminada')(sequelize),
  AgentExecutionLog: require('./agent-execution-log')(sequelize),
  ReporteDiario: require('./reporte-diario')(sequelize),
  DriveDocumento: require('./drive-documento')(sequelize),
  DriveSyncState: require('./drive-sync-state')(sequelize),
  Asistencia: require('./asistencia')(sequelize),
};
const { Colaborador, Usuario, Sesion, Solicitud, ConsultaChat, AgentExecutionLog } = models;
const options = { onDelete: 'RESTRICT', onUpdate: 'RESTRICT' };
Colaborador.belongsTo(Colaborador, { ...options, as: 'jefe', foreignKey: 'jefe_id' });
Colaborador.hasMany(Colaborador, { ...options, as: 'subordinados', foreignKey: 'jefe_id' });
Usuario.belongsTo(Colaborador, { ...options, as: 'colaborador', foreignKey: 'colaborador_id' });
Colaborador.hasOne(Usuario, { ...options, as: 'usuario', foreignKey: 'colaborador_id' });
Sesion.belongsTo(Usuario, { ...options, as: 'usuario', foreignKey: 'usuario_id' });
Usuario.hasMany(Sesion, { ...options, as: 'sesiones', foreignKey: 'usuario_id' });
for (const [name, as] of [
  ['SaldoVacaciones', 'saldos'], ['Solicitud', 'solicitudes'], ['Incapacidad', 'incapacidades'],
  ['MovimientoPersonal', 'movimientos'], ['Pago', 'pagos'], ['Evaluacion', 'evaluaciones'],
  ['ConsultaChat', 'consultas'], ['Asistencia', 'asistencias'],
]) {
  models[name].belongsTo(Colaborador, { ...options, as: 'colaborador', foreignKey: 'colaborador_id' });
  Colaborador.hasMany(models[name], { ...options, as, foreignKey: 'colaborador_id' });
}
Solicitud.belongsTo(Colaborador, { ...options, as: 'aprobador', foreignKey: 'aprobador_id' });
Colaborador.hasMany(Solicitud, { ...options, as: 'solicitudesPorAprobar', foreignKey: 'aprobador_id' });
AgentExecutionLog.belongsTo(ConsultaChat, { ...options, as: 'consultaChat', foreignKey: 'consulta_chat_id' });
ConsultaChat.hasMany(AgentExecutionLog, { ...options, as: 'ejecuciones', foreignKey: 'consulta_chat_id' });

module.exports = { sequelize, ...models };
