const { integer } = require('./env');

function databaseOptions(environment = process.env.NODE_ENV || 'development', migration = false) {
  if (!['development', 'test', 'production'].includes(environment)) {
    throw new Error('NODE_ENV debe ser development, test o production.');
  }
  const database = environment === 'test'
    ? process.env.DB_TEST_NAME || 'bosque_claro_test'
    : process.env.DB_NAME || 'bosque_claro_dev';
  if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('DB_NAME/DB_TEST_NAME inválido.');
  return {
    dialect: 'mysql',
    database,
    username: (migration && process.env.DB_MIGRATION_USER) || process.env.DB_USER || 'bosque_claro_app',
    password: migration && process.env.DB_MIGRATION_USER
      ? passwordValue('DB_MIGRATION_PASSWORD') : passwordValue('DB_PASSWORD'),
    host: process.env.DB_HOST || '127.0.0.1',
    port: integer('DB_PORT', 3306),
    logging: false,
    timezone: '+00:00',
    dialectOptions: {
      connectTimeout: integer('DB_CONNECT_TIMEOUT_MS', 5000, 1, 60000),
      decimalNumbers: false,
      ...(process.env.DB_SOCKET_PATH ? { socketPath: process.env.DB_SOCKET_PATH } : {}),
    },
    pool: { max: 5, min: 0, acquire: 10000, idle: 10000 },
    define: { timestamps: false, freezeTableName: true, charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
  };
}

function passwordValue(key) {
  // BASE64 permite copiar perfiles con caracteres especiales sin errores de escape dotenv.
  // Sigue siendo un secreto: base64 no es cifrado.
  const encoded = process.env[`${key}_BASE64`];
  return encoded ? Buffer.from(encoded, 'base64').toString('utf8') : process.env[key] || '';
}

module.exports = { databaseOptions };
