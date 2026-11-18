const { jsonRequest } = require('./ingestion-http');

class EmbeddingClient {
  constructor(config, request = jsonRequest) { this.config = config; this.request = request; }

  async embed(texts, { taskType = 'RETRIEVAL_DOCUMENT' } = {}) {
    if (!Array.isArray(texts) || !texts.length || texts.some((text) => typeof text !== 'string' || !text.trim())) throw new Error('EMBEDDING_INPUT_INVALID');
    const { embeddingProvider, embeddingModel, embeddingApiKey, embeddingDimension } = this.config;
    let result;
    if (embeddingProvider === 'openai') {
      result = await this.request('https://api.openai.com/v1/embeddings', { method: 'POST',
        headers: { Authorization: `Bearer ${embeddingApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: embeddingModel, input: texts, dimensions: embeddingDimension, encoding_format: 'float' }) });
      const rows = [...(result?.data || [])].sort((a, b) => a.index - b.index).map((row) => row.embedding);
      return validate(rows, texts.length, embeddingDimension);
    }
    if (embeddingProvider === 'gemini') {
      result = await this.request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(embeddingModel)}:batchEmbedContents`, {
        method: 'POST', headers: { 'x-goog-api-key': embeddingApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: texts.map((content) => ({ model: `models/${embeddingModel}`,
          content: { parts: [{ text: content }] }, taskType, outputDimensionality: embeddingDimension })) }),
      });
      return validate((result?.embeddings || []).map((row) => row.values), texts.length, embeddingDimension);
    }
    throw new Error('EMBEDDING_PROVIDER_UNSUPPORTED');
  }
}

function validate(vectors, expectedCount, dimension) {
  if (!Array.isArray(vectors) || vectors.length !== expectedCount) throw new Error('EMBEDDING_COUNT_MISMATCH');
  for (const vector of vectors) {
    if (!Array.isArray(vector) || vector.length !== dimension || vector.some((value) => typeof value !== 'number' || !Number.isFinite(value))
      || vector.every((value) => value === 0)) {
      throw new Error('EMBEDDING_DIMENSION_MISMATCH');
    }
  }
  return vectors;
}

module.exports = { EmbeddingClient, validate };
