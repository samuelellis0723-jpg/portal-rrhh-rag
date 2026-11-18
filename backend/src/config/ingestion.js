const { integer } = require('./env');

function ingestionConfig() {
  const embeddingProvider = (process.env.INGEST_EMBEDDING_PROVIDER || process.env.AI_PROVIDER || '').toLowerCase();
  const embeddingModel = process.env.INGEST_EMBEDDING_MODEL || process.env.AI_EMBEDDING_MODEL || '';
  const embeddingApiKey = process.env.INGEST_EMBEDDING_API_KEY || process.env.AI_API_KEY || '';
  const embeddingDimension = Number(process.env.INGEST_EMBEDDING_DIMENSION || process.env.AI_EMBEDDING_DIMENSION || 0);
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  const qdrantUrl = process.env.QDRANT_URL || '';
  const collection = process.env.QDRANT_COLLECTION || 'bosque_claro_politicas';
  if (!folderId || !/^[\w-]{10,200}$/.test(folderId)) throw new Error('GOOGLE_DRIVE_FOLDER_ID no está configurado correctamente.');
  if (!['openai', 'gemini'].includes(embeddingProvider)) throw new Error('INGEST_EMBEDDING_PROVIDER debe ser openai o gemini (también se acepta AI_PROVIDER).');
  if (!embeddingModel || !embeddingApiKey || !Number.isSafeInteger(embeddingDimension) || embeddingDimension < 1 || embeddingDimension > 10000) {
    throw new Error('Falta la configuración de proveedor, API key, modelo o dimensión de embeddings.');
  }
  let parsed;
  try { parsed = new URL(qdrantUrl); } catch { throw new Error('QDRANT_URL debe ser una URL HTTP(S) válida.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('QDRANT_URL debe usar HTTP(S).');
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(collection)) throw new Error('QDRANT_COLLECTION inválida.');
  return {
    folderId, qdrantUrl: qdrantUrl.replace(/\/$/, ''), qdrantApiKey: process.env.QDRANT_API_KEY || '', collection,
    embeddingProvider, embeddingModel, embeddingApiKey, embeddingDimension,
    batchSize: integer('INGEST_EMBEDDING_BATCH_SIZE', 32, 1, 128),
    chunkSize: integer('INGEST_CHUNK_SIZE', 3200, 500, 12000),
    chunkOverlap: integer('INGEST_CHUNK_OVERLAP', 400, 0, 2000),
    minTextChars: integer('INGEST_MIN_TEXT_CHARS', 80, 20, 10000),
    maxDownloadBytes: integer('INGEST_MAX_DOWNLOAD_BYTES', 20 * 1024 * 1024, 1024, 100 * 1024 * 1024),
    leaseSeconds: integer('INGEST_LEASE_SECONDS', 900, 60, 3600),
    driveCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  };
}

module.exports = { ingestionConfig };
