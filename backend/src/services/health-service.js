const sequelize = require('../config/database');

async function health() {
  try {
    await sequelize.authenticate();
    return { statusCode: 200, body: { data: { status: 'ok', database: 'up' } } };
  } catch {
    return { statusCode: 503, body: {
      error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'MySQL no está disponible.' },
      data: { status: 'degraded', database: 'down' },
    } };
  }
}

module.exports = { health };
