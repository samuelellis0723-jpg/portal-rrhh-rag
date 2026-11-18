const { jsonRequest } = require('./ingestion-http');

class QdrantClient {
  constructor(config, request = jsonRequest) { this.config = config; this.request = request; }
  get base() { return `${this.config.qdrantUrl}/collections/${encodeURIComponent(this.config.collection)}`; }
  get headers() { return this.config.qdrantApiKey ? { 'api-key': this.config.qdrantApiKey } : {}; }
  async requestJson(url, options = {}) { return this.request(url, { ...options, headers: { ...this.headers, 'Content-Type': 'application/json', ...options.headers } }); }

  async ensureCollection() {
    try {
      const current = await this.requestJson(this.base);
      const vectors = current?.result?.config?.params?.vectors;
      const size = typeof vectors?.size === 'number' ? vectors.size : vectors?.['']?.size;
      const distance = typeof vectors?.distance === 'string' ? vectors.distance : vectors?.['']?.distance;
      if (size !== this.config.embeddingDimension || distance !== 'Cosine') throw new Error('QDRANT_COLLECTION_CONFIG_MISMATCH');
    } catch (error) {
      if (error.status !== 404) throw error;
      await this.requestJson(this.base, { method: 'PUT', body: JSON.stringify({ vectors: { size: this.config.embeddingDimension, distance: 'Cosine' } }) });
    }
    await this.requestJson(`${this.base}/index`, { method: 'PUT', body: JSON.stringify({ field_name: 'drive_revision', field_schema: 'keyword' }) }).catch(ignoreConflict);
    await this.requestJson(`${this.base}/index`, { method: 'PUT', body: JSON.stringify({ field_name: 'folder_id', field_schema: 'keyword' }) }).catch(ignoreConflict);
    await this.requestJson(`${this.base}/index`, { method: 'PUT', body: JSON.stringify({ field_name: 'embedding_space', field_schema: 'keyword' }) }).catch(ignoreConflict);
    await this.requestJson(`${this.base}/index`, { method: 'PUT', body: JSON.stringify({ field_name: 'drive_file_id', field_schema: 'keyword' }) }).catch(ignoreConflict);
    await this.requestJson(`${this.base}/index`, { method: 'PUT', body: JSON.stringify({ field_name: 'revision_indexada', field_schema: 'keyword' }) }).catch(ignoreConflict);
    await this.requestJson(`${this.base}/index`, { method: 'PUT', body: JSON.stringify({ field_name: 'estado_documental', field_schema: 'keyword' }) }).catch(ignoreConflict);
  }

  async upsert(points) {
    if (!points.length) return;
    return completedWrite(await this.requestJson(`${this.base}/points?wait=true`, { method: 'PUT', body: JSON.stringify({ points }) }));
  }
  async deleteFile(fileId) {
    return completedWrite(await this.requestJson(`${this.base}/points/delete?wait=true`, { method: 'POST', body: JSON.stringify({ filter: { must: [{ key: 'drive_file_id', match: { value: fileId } }] } }) }));
  }
  async deleteFileExcept(fileId, activeRevision) {
    return completedWrite(await this.requestJson(`${this.base}/points/delete?wait=true`, { method: 'POST', body: JSON.stringify({ filter: { must: [
      { key: 'drive_file_id', match: { value: fileId } },
      { key: 'drive_revision', match: { except: [`${fileId}:${activeRevision}`] } },
    ] } }) }));
  }
  async search(vector, limit = 5, activeDocuments = [], folderId = '', embeddingSpace = '') {
    if (!activeDocuments.length) return { result: [] };
    return this.requestJson(`${this.base}/points/search`, { method: 'POST', body: JSON.stringify({ vector, limit, with_payload: true,
      filter: { must: [{ key: 'estado_documental', match: { value: 'preparado_simulacion' } },
        ...(folderId ? [{ key: 'folder_id', match: { value: folderId } }] : []),
        ...(embeddingSpace ? [{ key: 'embedding_space', match: { value: embeddingSpace } }] : []),
        { key: 'drive_revision', match: { any: activeDocuments.map((doc) => `${doc.drive_file_id}:${doc.revision_indexada}`) } }] } }) });
  }
}
function completedWrite(response) {
  if (response?.status !== 'ok' || response.result?.status !== 'completed') throw new Error('QDRANT_WRITE_NOT_CONFIRMED');
  return response;
}
function ignoreConflict(error) {
  if (error.status === 409) return;
  const detail = JSON.stringify(error.payload || {}).toLowerCase();
  if (error.status === 400 && /already exists|field .* already indexed|index .* already exists/.test(detail)) return;
  throw error;
}

module.exports = { QdrantClient };
