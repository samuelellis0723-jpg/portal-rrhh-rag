const { llmConfig } = require('../config/llm');

class DeepSeekClient {
  constructor(config = llmConfig(), fetcher = fetch) {
    this.config = config;
    this.fetcher = fetcher;
  }

  async request({ system, user, maxTokens = this.config.maxTokens, json = false, temperature = 0.1 }) {
    if (!this.config.apiKey) throw new Error('DEEPSEEK_API_KEY_MISSING');
    if (typeof system !== 'string' || typeof user !== 'string' || !system.trim() || !user.trim()) throw new Error('DEEPSEEK_INPUT_INVALID');
    const response = await this.fetcher(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST', signal: AbortSignal.timeout(this.config.timeoutMs),
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ model: this.config.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: maxTokens, temperature, thinking: { type: 'disabled' }, ...(json ? { response_format: { type: 'json_object' } } : {}) }),
    });
    let payload;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) {
      const error = new Error('DEEPSEEK_UNAVAILABLE');
      error.status = response.status;
      throw error;
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim() || payload.choices[0].finish_reason !== 'stop') throw new Error('DEEPSEEK_INVALID_RESPONSE');
    return content.trim();
  }

  async completeJson(options) {
    const content = await this.request({ ...options, json: true });
    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch { throw new Error('DEEPSEEK_INVALID_JSON'); }
  }

  complete(options) { return this.request({ ...options, json: false }); }
}

module.exports = { DeepSeekClient };
