const mysql = require('mysql2/promise');
const { databaseOptions } = require('../src/config/database-options');

async function main() {
  const config = databaseOptions(process.env.NODE_ENV || 'development', true);
  if (process.env.NODE_ENV === 'production') throw new Error('Creación automática deshabilitada en producción.');
  const connection = await mysql.createConnection({
    host: config.host, port: config.port, user: config.username, password: config.password,
    ...config.dialectOptions,
  });
  try {
    const [rows] = await connection.query('SELECT VERSION() AS version');
    const version = rows[0].version;
    const [major, minor, patch] = version.split('.').map(Number);
    if (/mariadb/i.test(version) || major < 8 || (major === 8 && minor === 0 && patch < 16)) {
      throw new Error('Se requiere MySQL >= 8.0.16 para aplicar CHECK.');
    }
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log('Base de desarrollo disponible; no se borraron datos.');
  } finally { await connection.end(); }
}

main().catch((error) => {
  console.error('No se pudo preparar la base:', error.code || 'CONFIGURATION_ERROR');
  process.exitCode = 1;
});
