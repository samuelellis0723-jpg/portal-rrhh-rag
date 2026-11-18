// El snapshot v1 conserva la definición original de las migraciones aplicadas.
// Las ampliaciones se documentan aquí y se aplican mediante migraciones nuevas.
const schema = structuredClone(require('./schema-v1.json'));
schema.consultas_chat.fields.respuesta_json = { type: 'json', allowNull: true };

module.exports = schema;
