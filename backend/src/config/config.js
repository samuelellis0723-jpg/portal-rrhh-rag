const { databaseOptions } = require('./database-options');

// Sequelize CLI utiliza la identidad de migraciones; la app usa config/database.js.
module.exports = Object.fromEntries(
  ['development', 'test', 'production'].map((environment) => [environment, {
    ...databaseOptions(environment, true),
    migrationStorage: 'sequelize',
    migrationStorageTableName: 'SequelizeMeta',
    seederStorage: 'sequelize',
    seederStorageTableName: 'SequelizeData',
  }]),
);
