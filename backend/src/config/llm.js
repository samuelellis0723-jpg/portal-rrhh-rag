const { integer } = require('./env');

function llmConfig() {
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  let parsed;
  try { parsed = new URL(baseUrl); } catch { throw new Error('DEEPSEEK_BASE_URL inválida.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('DEEPSEEK_BASE_URL inválida.');
  }
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-flash',
    baseUrl: baseUrl.replace(/\/$/, ''),
    timeoutMs: integer('DEEPSEEK_TIMEOUT_MS', 45000, 1000, 120000),
    maxTokens: integer('DEEPSEEK_MAX_TOKENS', 1200, 128, 8192),
  };
}

module.exports = { llmConfig };
