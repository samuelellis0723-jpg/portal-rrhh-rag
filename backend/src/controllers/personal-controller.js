const service = require('../services/personal-service');

async function getNextPayment(req, res) { res.json({ data: await service.getNextPayment(req.auth) }); }
async function getNextEvaluation(req, res) { res.json({ data: await service.getNextEvaluation(req.auth) }); }
async function getRequests(req, res) { res.json({ data: await service.getRequests(req.auth, req.pagination) }); }

module.exports = { getNextPayment, getNextEvaluation, getRequests };
