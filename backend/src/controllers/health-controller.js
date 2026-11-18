const healthService = require('../services/health-service');

async function getHealth(req, res) {
  const result = await healthService.health();
  res.status(result.statusCode).json(result.body);
}

module.exports = { getHealth };
