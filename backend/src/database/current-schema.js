// El snapshot v1 conserva la definición original de las migraciones aplicadas.
// Las ampliaciones se documentan aquí y se aplican mediante migraciones nuevas.
const schema = structuredClone(require('./schema-v1.json'));
schema.consultas_chat.fields.respuesta_json = { type: 'json', allowNull: true };
schema.usuarios.fields.nombres = { type: 'varchar(160)', allowNull: false };

schema.chat_metricas_eliminadas = require('./chat-metrics-schema');
schema.asistencias = require('./asistencias-schema');

module.exports = schema;
