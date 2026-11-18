const { getOwnBalance } = require('../services/vacaciones-service');

async function vacaciones(req, res) {
  res.json({ data: await getOwnBalance(req.auth, req.pagination) });
}

module.exports = { vacaciones };
