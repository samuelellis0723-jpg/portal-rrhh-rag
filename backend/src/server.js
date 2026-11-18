const { integer } = require('./config/env');
const app = require('./app');
const sequelize = require('./config/database');

const server = app.listen(integer('PORT', 3001, 0), process.env.HOST || '127.0.0.1');
server.on('listening', () => {
  console.log(`Backend Bosque Claro escuchando en puerto ${server.address().port}.`);
});
server.on('error', (error) => {
  console.error('No se pudo iniciar HTTP:', error.code || 'SERVER_ERROR');
  process.exitCode = 1;
});

function shutdown() {
  server.close(async () => { await sequelize.close(); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
