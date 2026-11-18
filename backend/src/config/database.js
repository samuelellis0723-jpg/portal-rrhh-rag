const { Sequelize } = require('sequelize');
const { databaseOptions } = require('./database-options');

// Importar este módulo no conecta ni crea tablas.
module.exports = new Sequelize(databaseOptions());
