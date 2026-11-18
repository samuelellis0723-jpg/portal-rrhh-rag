#!/usr/bin/env node
require('../src/config/env');
const { GoogleDriveClient } = require('../src/integrations/google-drive');
const { QdrantClient } = require('../src/integrations/qdrant');
const { EmbeddingClient } = require('../src/integrations/embeddings');
const { ingestionConfig } = require('../src/config/ingestion');
const { sequelize } = require('../src/models');

async function main() {
  const live = process.argv.includes('--live');
  const statuses = { mode: live ? 'live' : 'configuration' };
  let config;
  try { config = ingestionConfig(); statuses.config = 'ready'; statuses.collection_name_valid = true; }
  catch { statuses.config = 'missing_or_invalid'; statuses.required = missingConfiguration(); }
  if (live && config) {
    const drive = new GoogleDriveClient({ folderId: config.folderId, credentialsPath: config.driveCredentials });
    try {
      const folder = await drive.getFile(config.folderId);
      if (folder.mimeType !== 'application/vnd.google-apps.folder' || folder.trashed) throw new Error('FOLDER_INVALID');
      statuses.drive_children_count = (await drive.listFolderFiles()).length;
      statuses.drive = 'folder_authorized';
    }
    catch (error) { statuses.drive = classify(error); }
    const qdrant = new QdrantClient(config);
    try {
      await qdrant.requestJson(`${config.qdrantUrl}/readyz`); statuses.qdrant = 'reachable';
      try {
        const collection = await qdrant.requestJson(qdrant.base);
        statuses.qdrant_collection_points = collection.result?.points_count ?? null;
        const vectors = collection.result?.config?.params?.vectors;
        statuses.qdrant_collection_config_matches = vectors?.size === config.embeddingDimension && vectors?.distance === 'Cosine';
      } catch (error) {
        statuses.qdrant_collection_config_matches = error.status === 404 ? null : false;
        statuses.qdrant_collection_state = error.status === 404 ? 'pending_initial_sync' : 'unavailable';
      }
    }
    catch (error) { statuses.qdrant = classify(error); }
    try { await new EmbeddingClient(config).embed(['Prueba técnica de acceso al servicio de embeddings en español.']); statuses.embeddings = 'authorized_and_dimension_verified'; }
    catch (error) { statuses.embeddings = classify(error); }
  }
  process.stdout.write(`${JSON.stringify(statuses, null, 2)}\n`);
  await sequelize.close();
  if (statuses.config !== 'ready' || (live && (statuses.qdrant_collection_config_matches === false || ['drive', 'qdrant', 'embeddings'].some((key) => statuses[key] !== (key === 'embeddings' ? 'authorized_and_dimension_verified' : key === 'drive' ? 'folder_authorized' : 'reachable'))))) process.exitCode = 1;
}

function missingConfiguration() {
  const has = (key) => Boolean(process.env[key]);
  const provider = process.env.INGEST_EMBEDDING_PROVIDER || process.env.AI_PROVIDER;
  return [
    ...(!has('GOOGLE_DRIVE_FOLDER_ID') ? ['GOOGLE_DRIVE_FOLDER_ID'] : []),
    ...(!has('QDRANT_URL') ? ['QDRANT_URL'] : []),
    ...(!provider ? ['INGEST_EMBEDDING_PROVIDER (o AI_PROVIDER)'] : []),
    ...(!(process.env.INGEST_EMBEDDING_MODEL || process.env.AI_EMBEDDING_MODEL) ? ['INGEST_EMBEDDING_MODEL (o AI_EMBEDDING_MODEL)'] : []),
    ...(!(process.env.INGEST_EMBEDDING_API_KEY || process.env.AI_API_KEY) ? ['INGEST_EMBEDDING_API_KEY (o AI_API_KEY)'] : []),
    ...(!(process.env.INGEST_EMBEDDING_DIMENSION || process.env.AI_EMBEDDING_DIMENSION) ? ['INGEST_EMBEDDING_DIMENSION (o AI_EMBEDDING_DIMENSION)'] : []),
  ];
}
function classify(error) { return error.status === 401 || error.status === 403 ? 'unauthorized' : error.status === 404 ? 'not_found' : 'unavailable'; }

main().catch(async () => { process.stdout.write(`${JSON.stringify({ mode: process.argv.includes('--live') ? 'live' : 'configuration', config: 'missing_or_invalid', status: 'failed' }, null, 2)}\n`); await sequelize.close().catch(() => {}); process.exitCode = 1; });
