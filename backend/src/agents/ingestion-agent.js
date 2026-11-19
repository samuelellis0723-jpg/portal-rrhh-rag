const { createHash } = require('node:crypto');
const { ingestionConfig } = require('../config/ingestion');
const { GoogleDriveClient } = require('../integrations/google-drive');
const { EmbeddingClient } = require('../integrations/embeddings');
const { QdrantClient } = require('../integrations/qdrant');
const { extractDocument, TYPES } = require('../integrations/document-extractor');
const { splitDocument } = require('../services/ingestion-chunker');
const repository = require('../repositories/drive-ingestion-repository');

const hash = (text) => createHash('sha256').update(text).digest('hex');
const pointId = (value) => {
  const bytes = Buffer.from(hash(value).slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const id = bytes.toString('hex');
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
};
const props = (file) => ({ ...(file.properties || {}), ...(file.appProperties || {}) });

class IngestionAgent {
  constructor({ config = ingestionConfig(), drive, embeddings, qdrant, store = repository, extract = extractDocument,
    chunk = splitDocument, clock = () => new Date() } = {}) {
    this.config = config;
    this.drive = drive || new GoogleDriveClient({ folderId: config.folderId, credentialsPath: config.driveCredentials,
      maxDownloadBytes: config.maxDownloadBytes });
    this.embeddings = embeddings || new EmbeddingClient(config);
    this.qdrant = qdrant || new QdrantClient(config);
    this.store = store;
    this.extract = extract;
    this.chunk = chunk;
    this.clock = clock;
  }

  async sync({ forceFull = false } = {}) {
    const startedAt = this.clock();
    let report;
    try {
      const locked = await this.store.withLock(this.config.folderId, this.config.leaseSeconds * 1000, async () => {
        try { await this.drive.assertAuthorizedFolder(); }
        catch (error) {
          if ([403, 404].includes(error.status)) {
            // Una pérdida de permiso no equivale a una carpeta vacía ni a una caída temporal.
            for (const document of await this.store.listDocumentsForFolder(this.config.folderId)) {
              if (!document.eliminado) await this.store.markError(document.drive_file_id);
            }
            await this.store.forceFullReconcile(this.config.folderId);
          }
          throw error;
        }
        await this.qdrant.ensureCollection();
        let state = await this.store.getState(this.config.folderId);
        if (forceFull) await this.store.forceFullReconcile(this.config.folderId);
        if (forceFull || !state || state.page_token === 'pending') report = { mode: forceFull ? 'reconciled' : 'initial', ...await this.initialSnapshot() };
        let reconciled = false;
        while (true) {
          state = await this.store.getState(this.config.folderId);
          const counts = { indexed: 0, skipped: 0, deleted: 0, errors: 0, pages: 0 };
          let token = state.page_token;
          try {
            while (true) {
              const page = await this.drive.listChanges(token);
              for (const change of page.changes) {
                const result = await this.processChange(change);
                counts[result] += 1;
              }
              const next = page.nextPageToken || page.newStartPageToken;
              if (!next) throw new Error('DRIVE_CHANGE_CURSOR_MISSING');
              await this.store.setCursor(this.config.folderId, next);
              token = next;
              counts.pages += 1;
              if (!page.nextPageToken) break;
            }
            report = { ...(report || { mode: 'incremental' }), changes: counts };
            break;
          } catch (error) {
            if (error.status !== 410 || reconciled) throw error;
            reconciled = true;
            await this.store.forceFullReconcile(this.config.folderId);
            report = { mode: 'reconciled', ...await this.initialSnapshot() };
          }
        }
        return report;
      });
      if (!locked.locked) throw new Error('INGESTION_ALREADY_RUNNING');
      report = locked.result;
      await this.store.logExecution({ startedAt, status: 'completada', context: { mode: report.mode, indexed: report.indexed, changes: report.changes } });
      return report;
    } catch (error) {
      const code = safeCode(error);
      await this.store.logExecution({ startedAt, status: 'fallida', errorCode: code, context: { stage: 'sync' } }).catch(() => {});
      throw error;
    }
  }

  async initialSnapshot() {
    // Capture the cursor before listing so subsequent changes replay the snapshot window.
    const startToken = await this.drive.getStartPageToken();
    const files = await this.drive.listFolderFiles();
    const seen = new Set();
    const counts = { indexed: 0, skipped: 0, deleted: 0, errors: 0 };
    for (const file of files) {
      seen.add(file.id);
      counts[await this.processFile(file)] += 1;
    }
    for (const doc of await this.store.listDocumentsForFolder(this.config.folderId)) if (!seen.has(doc.drive_file_id)) {
      await this.retire(doc.drive_file_id);
      counts.deleted += 1;
    }
    await this.store.setCursor(this.config.folderId, startToken);
    return counts;
  }

  async processChange(change) {
    let file = change.file;
    const current = await this.store.getDocument(change.fileId);
    if (change.removed) {
      if (!current) return 'skipped';
      await this.retire(change.fileId, file?.modifiedTime);
      return 'deleted';
    }
    if (!file) {
      try { file = await this.drive.getFile(change.fileId); }
      catch (error) {
        if ([403, 404].includes(error.status)) {
          if (!current) return 'skipped';
          await this.retire(change.fileId);
          return 'deleted';
        }
        throw error;
      }
    }
    if (file.trashed || file.mimeType === 'application/vnd.google-apps.shortcut'
      || !Array.isArray(file.parents) || !file.parents.includes(this.config.folderId)) {
      if (!current) return 'skipped';
      await this.retire(change.fileId, file.modifiedTime);
      return 'deleted';
    }
    return this.processFile(file);
  }

  async processFile(file) {
    const current = await this.store.getDocument(file.id);
    let committed = false;
    try { return await this.processAuthorizedFile(file, current, () => { committed = true; }); }
    catch (error) {
      if (!committed) {
        if ([403, 404].includes(error.status) && current) await this.retire(file.id).catch(() => {});
        else await this.store.markError(file.id, file).catch(() => {});
      }
      throw error;
    }
  }

  async processAuthorizedFile(file, current, onCommit) {
    // Never follow shortcuts: they can point outside the authorized folder.
    if (file.mimeType === 'application/vnd.google-apps.shortcut' || file.trashed
      || !Array.isArray(file.parents) || !file.parents.includes(this.config.folderId)) {
      if (!current) return 'skipped';
      await this.retire(file.id, file.modifiedTime);
      return 'deleted';
    }
    if (!Object.values(TYPES).includes(file.mimeType)) {
      if (current) await this.retire(file.id, file.modifiedTime);
      return 'skipped';
    }
    // Re-fetch metadata and authorization immediately before downloading any body.
    file = await this.drive.getFile(file.id);
    if (file.trashed || !Array.isArray(file.parents) || !file.parents.includes(this.config.folderId)) {
      if (!current) return 'skipped';
      await this.retire(file.id, file.modifiedTime);
      return 'deleted';
    }
    const metadata = props(file);
    if (metadata.bosque_claro_estado !== 'preparado_simulacion') {
      if (current) await this.retire(file.id, file.modifiedTime);
      else await this.store.markUnapproved(file);
      return 'skipped';
    }
    const content = await this.extract(file, this.drive);
    const verified = await this.drive.getFile(file.id);
    if (verified.trashed || !Array.isArray(verified.parents) || !verified.parents.includes(this.config.folderId)) {
      if (!current) return 'skipped';
      await this.retire(file.id, verified.modifiedTime);
      return 'deleted';
    }
    const verifiedProps = props(verified);
    if (verified.version !== file.version || verified.modifiedTime !== file.modifiedTime
      || verifiedProps.bosque_claro_estado !== metadata.bosque_claro_estado
      || verifiedProps.bosque_claro_version !== metadata.bosque_claro_version) throw new Error('DRIVE_FILE_CHANGED_DURING_READ');
    if (content.length < this.config.minTextChars) throw new Error('DOCUMENT_TEXT_TOO_SHORT');
    const contentChecksum = hash(content);
    const revision = hash(`${this.config.embeddingProvider}:${this.config.embeddingModel}:${this.config.embeddingDimension}:${this.config.chunkSize}:${this.config.chunkOverlap}:pipeline-v2\n${file.version || ''}\n${file.modifiedTime || ''}\n${metadata.bosque_claro_version || ''}\n${contentChecksum}`);
    if (current && !current.eliminado && current.revision_indexada === revision && current.estado_indexacion === 'indexado') {
      await this.qdrant.deleteFileExcept(file.id, revision);
      return 'skipped';
    }
    const chunks = this.chunk(content, { maxChars: this.config.chunkSize, overlap: this.config.chunkOverlap });
    if (!chunks.length) throw new Error('DOCUMENT_HAS_NO_CHUNKS');
    const vectors = [];
    for (let i = 0; i < chunks.length; i += this.config.batchSize) {
      const batch = chunks.slice(i, i + this.config.batchSize);
      vectors.push(...await this.embeddings.embed(batch.map((chunk) => `${file.name}\n${chunk.section}\n${chunk.text}`)));
    }
    const version = String(metadata.bosque_claro_version || file.version || file.modifiedTime || 'sin-version').slice(0, 80);
    const link = file.webViewLink || `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`;
    const points = chunks.map((chunk, index) => ({
      id: pointId(`${file.id}:${revision}:${index}`), vector: vectors[index],
      payload: {
        drive_file_id: file.id, documento: file.name, nombre: file.name, enlace: link, version,
        modificado_drive_en: file.modifiedTime || null, seccion: chunk.section,
        fragmento_id: pointId(`${file.id}:${revision}:${index}`), revision_indexada: revision,
        folder_id: this.config.folderId,
        embedding_space: `${this.config.embeddingProvider}:${this.config.embeddingModel}:${this.config.embeddingDimension}`,
        drive_revision: `${file.id}:${revision}`, estado_documental: 'preparado_simulacion',
        texto: chunk.text, fuente: 'Google Drive', external_document_id: metadata.bosque_claro_document_id || null,
      },
    }));
    await this.qdrant.upsert(points);
    await this.store.saveIndexedDocument(file, { version, checksum: contentChecksum, revision });
    onCommit();
    // The SQL revision is switched only after all points are durable; old vectors are then safe to remove.
    await this.qdrant.deleteFileExcept(file.id, revision);
    return 'indexed';
  }

  async retire(fileId, modifiedTime) {
    await this.store.markDeleted(fileId, modifiedTime);
    await this.qdrant.deleteFile(fileId);
  }

  async search(query, limit = 5) {
    const value = String(query || '').trim();
    if (!value || value.length > 1000) throw new Error('SEARCH_QUERY_INVALID');
    const [vector] = await this.embeddings.embed([value], { taskType: 'RETRIEVAL_QUERY' });
    const active = await this.store.listActiveDocuments();
    const result = await this.qdrant.search(vector, limit, active, this.config.folderId,
      `${this.config.embeddingProvider}:${this.config.embeddingModel}:${this.config.embeddingDimension}`);
    return (result.result || []).filter((row) => active.some((doc) => doc.drive_file_id === row.payload?.drive_file_id
      && doc.revision_indexada === row.payload?.revision_indexada)).map((row) => ({ score: row.score, ...row.payload }));
  }
}

function safeCode(error) {
  if (error.status === 410) return 'DRIVE_CURSOR_INVALID';
  return String(error.message || 'INGESTION_ERROR').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 80);
}

module.exports = { IngestionAgent, pointId };
