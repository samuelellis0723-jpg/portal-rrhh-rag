const service = require('../services/auth-service');
const { authConfig } = require('../config/auth');

async function login(req, res) {
  const result = await service.login(req.body.email.trim().toLowerCase(), req.body.password);
  const config = authConfig();
  res.cookie(config.cookieName, result.token, { ...config.cookie, expires: result.session.expira_en });
  res.json({ data: result.data });
}

function session(req, res) { res.json({ data: req.auth.data }); }

async function logout(req, res) {
  await service.logout(req.auth.session.id);
  const config = authConfig();
  res.clearCookie(config.cookieName, config.cookie);
  res.status(204).end();
}

module.exports = { login, session, logout };
