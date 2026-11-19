// Métricas sin identidad ni contenido, agrupadas por fecha de Costa Rica y tema.
module.exports = {
  fields: {
    fecha: { type: 'date', allowNull: false, primaryKey: true },
    tema: { type: 'varchar(100)', allowNull: false, primaryKey: true },
    consultas: { type: 'int', allowNull: false },
    resueltas: { type: 'int', allowNull: false },
    sin_respuesta: { type: 'int', allowNull: false },
    latencia_total: { type: 'decimal(20,0)', allowNull: false },
    latencia_count: { type: 'int', allowNull: false },
  },
  indexes: [], checks: [],
};
