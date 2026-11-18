const { Op } = require('sequelize');
const { sequelize, DriveDocumento, DriveSyncState, AgentExecutionLog } = require('../models');

const now = () => new Date();

async function ensureState(folderId) {
  try { await DriveSyncState.create({ carpeta_drive_id: folderId, page_token: 'pending', estado: 'pendiente' }); }
  catch (error) { if (error.name !== 'SequelizeUniqueConstraintError') throw error; }
  return DriveSyncState.findOne({ where: { carpeta_drive_id: folderId } });
}

async function acquireLock(folderId, durationMs) {
  await ensureState(folderId);
  const connection = await sequelize.connectionManager.getConnection({ uuid: `drive-ingest:${folderId}` });
  let acquired = false;
  try {
    const [rows] = await new Promise((resolve, reject) => connection.query('SELECT GET_LOCK(?, 0) AS acquired', [lockName(folderId)], (err, data) => err ? reject(err) : resolve(data)));
    if (!Number(rows?.acquired)) { await sequelize.connectionManager.releaseConnection(connection); return null; }
    acquired = true;
    await DriveSyncState.update({ bloqueo_hasta: new Date(Date.now() + durationMs), estado: 'sincronizando', ultimo_error: null },
      { where: { carpeta_drive_id: folderId } });
    return { connection, lockName: lockName(folderId) };
  } catch (error) {
    if (acquired) await new Promise((resolve) => connection.query('SELECT RELEASE_LOCK(?)', [lockName(folderId)], () => resolve()));
    await sequelize.connectionManager.releaseConnection(connection);
    throw error;
  }
}

async function releaseLock(folderId, lock, status = 'ok', errorCode = null) {
  try {
    const state = await DriveSyncState.findOne({ where: { carpeta_drive_id: folderId } });
    if (state) await state.update({ bloqueo_hasta: null, estado: status, ultimo_error: errorCode });
  } finally {
    try { await new Promise((resolve, reject) => lock.connection.query('SELECT RELEASE_LOCK(?)', [lock.lockName], (err) => err ? reject(err) : resolve())); }
    finally { await sequelize.connectionManager.releaseConnection(lock.connection); }
  }
}

function lockName(folderId) { return `bc-drive-${require('node:crypto').createHash('sha256').update(folderId).digest('hex').slice(0, 48)}`; }

async function withLock(folderId, durationMs, fn) {
  let lock;
  try {
    lock = await acquireLock(folderId, durationMs);
    if (!lock) return { locked: false };
    const result = await fn();
    lock.status = 'ok';
    return { locked: true, result };
  } catch (error) {
    if (lock) { lock.status = 'error'; lock.errorCode = String(error.message || 'INGESTION_ERROR').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 80); }
    throw error;
  } finally {
    if (lock) await releaseLock(folderId, lock, lock.status, lock.errorCode);
  }
}

async function getState(folderId) { return DriveSyncState.findOne({ where: { carpeta_drive_id: folderId } }); }
async function setCursor(folderId, token, status = 'sincronizando') {
  await DriveSyncState.update({ page_token: String(token), sincronizado_en: now(), estado: status,
    ultimo_error: null }, { where: { carpeta_drive_id: folderId } });
}
async function getDocument(fileId) { return DriveDocumento.findOne({ where: { drive_file_id: fileId } }); }
async function getDocuments(fileIds) { return DriveDocumento.findAll({ where: { drive_file_id: { [Op.in]: fileIds } } }); }
async function listActiveDocuments() { return DriveDocumento.findAll({ where: { eliminado: false, estado_indexacion: 'indexado' } }); }
async function listDocumentsForFolder() { return DriveDocumento.findAll(); }
async function forceFullReconcile(folderId) {
  await DriveSyncState.update({ page_token: 'pending', estado: 'reconciliando', ultimo_error: 'DRIVE_CURSOR_INVALID' },
    { where: { carpeta_drive_id: folderId } });
}
async function markUnapproved(file) {
  const existing = await getDocument(file.id);
  const values = { nombre: file.name, enlace: file.webViewLink || `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`,
    mime_type: file.mimeType, version: file.version || null, modificado_drive_en: file.modifiedTime ? new Date(file.modifiedTime) : null,
    revision_indexada: null, estado_indexacion: 'retirado', eliminado: false, sincronizado_en: now() };
  if (existing) await existing.update(values); else await DriveDocumento.create({ drive_file_id: file.id, ...values });
}

async function saveIndexedDocument(file, values) {
  const existing = await DriveDocumento.findOne({ where: { drive_file_id: file.id } });
  const attributes = {
    drive_file_id: file.id, nombre: file.name, enlace: file.webViewLink || `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`,
    mime_type: file.mimeType, version: values.version, modificado_drive_en: file.modifiedTime ? new Date(file.modifiedTime) : null,
    checksum: values.checksum, revision_indexada: values.revision, estado_indexacion: 'indexado', eliminado: false, sincronizado_en: now(),
  };
  if (existing) await existing.update(attributes);
  else await DriveDocumento.create(attributes);
}

async function markDeleted(fileId, modifiedTime = null) {
  const existing = await getDocument(fileId);
  if (!existing) return;
  await existing.update({ eliminado: true, estado_indexacion: 'retirado', revision_indexada: null,
    modificado_drive_en: modifiedTime ? new Date(modifiedTime) : existing.modificado_drive_en, sincronizado_en: now() });
}

async function markError(fileId, file = {}) {
  const existing = await getDocument(fileId);
  const attributes = { nombre: file.name || existing?.nombre || `Drive ${fileId}`, enlace: file.webViewLink || existing?.enlace || null,
    mime_type: file.mimeType || existing?.mime_type || null, version: file.version || existing?.version || null,
    modificado_drive_en: file.modifiedTime ? new Date(file.modifiedTime) : existing?.modificado_drive_en || null,
    estado_indexacion: 'error', eliminado: false, sincronizado_en: now() };
  if (existing) await existing.update(attributes); else await DriveDocumento.create({ drive_file_id: fileId, ...attributes });
}

async function logExecution({ startedAt, status, errorCode = null, context = {} }) {
  const endedAt = now();
  await AgentExecutionLog.create({ consulta_chat_id: null, tipo_ejecucion: 'ingesta', agente: 'agente_ingesta',
    consulta: null, contexto: context, origen: 'ejecucion', fragmentos_usados: null, escalada: false,
    latencia_ms: Math.max(0, endedAt.getTime() - startedAt.getTime()), estado: status,
    codigo_error: errorCode, iniciada_en: startedAt, finalizada_en: endedAt });
}

module.exports = { ensureState, withLock, getState, setCursor, getDocument, getDocuments, listActiveDocuments, listDocumentsForFolder,
  forceFullReconcile, saveIndexedDocument, markDeleted, markUnapproved, markError, logExecution, sequelize };
