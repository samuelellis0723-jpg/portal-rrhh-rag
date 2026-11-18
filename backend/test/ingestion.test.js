const test = require('node:test');
const assert = require('node:assert/strict');
const { IngestionAgent, pointId } = require('../src/agents/ingestion-agent');
const { EmbeddingClient, validate } = require('../src/integrations/embeddings');
const { GoogleDriveClient } = require('../src/integrations/google-drive');
const { extractDocument, TYPES } = require('../src/integrations/document-extractor');
const { splitDocument } = require('../src/services/ingestion-chunker');

const config = { folderId: 'folder-authorized-123456789', embeddingProvider: 'openai', embeddingModel: 'text-embedding-3-small',
  embeddingDimension: 3, embeddingApiKey: 'test-key', batchSize: 10, chunkSize: 600, chunkOverlap: 50, minTextChars: 20, leaseSeconds: 900 };
const makeFile = (id, name = `${id}.pdf`, overrides = {}) => ({ id, name, mimeType: TYPES.pdf, parents: [config.folderId], version: '7',
  modifiedTime: '2026-11-17T12:00:00.000Z', webViewLink: `https://drive.google.com/file/d/${id}/view`,
  properties: { bosque_claro_estado: 'preparado_simulacion', bosque_claro_version: '1.0', bosque_claro_document_id: id }, ...overrides });

class FakeStore {
  constructor() { this.cursor = 'pending'; this.docs = new Map(); this.locked = false; this.logs = []; this.onSave = null; }
  async withLock(folder, duration, fn) {
    if (this.locked) return { locked: false };
    this.locked = true;
    try { return { locked: true, result: await fn() }; } finally { this.locked = false; }
  }
  async getState() { return { page_token: this.cursor }; }
  async setCursor(folder, token) { this.cursor = token; }
  async forceFullReconcile() { this.cursor = 'pending'; }
  async listDocumentsForFolder() { return [...this.docs.values()]; }
  async getDocument(id) { return this.docs.get(id) || null; }
  async listActiveDocuments() { return [...this.docs.values()].filter((doc) => !doc.eliminado && doc.estado_indexacion === 'indexado'); }
  async saveIndexedDocument(file, values) {
    this.docs.set(file.id, { drive_file_id: file.id, ...values, revision_indexada: values.revision, estado_indexacion: 'indexado', eliminado: false });
    await this.onSave?.(file, values);
  }
  async markDeleted(id) { const doc = this.docs.get(id); if (doc) Object.assign(doc, { eliminado: true, estado_indexacion: 'retirado', revision_indexada: null }); }
  async markUnapproved(file) { this.docs.set(file.id, { drive_file_id: file.id, estado_indexacion: 'retirado', revision_indexada: null, eliminado: false }); }
  async markError(id) { const doc = this.docs.get(id); if (doc) Object.assign(doc, { estado_indexacion: 'error', revision_indexada: null }); }
  async logExecution(log) { this.logs.push(log); }
}

class FakeDrive {
  constructor(files = []) { this.files = new Map(files.map((file) => [file.id, file])); this.snapshot = [...files]; this.pages = []; this.starts = 0; this.lists = 0; }
  async assertAuthorizedFolder() {}
  async getStartPageToken() { this.starts += 1; return `token-${this.starts}`; }
  async listFolderFiles() { this.lists += 1; return [...this.snapshot]; }
  async listChanges(token) { const page = this.pages.shift(); if (page instanceof Error) throw page; if (page) return page; return { changes: [], newStartPageToken: token }; }
  async getFile(id) { const file = this.files.get(id); if (!file) { const error = new Error('HTTP_404'); error.status = 404; throw error; } return file; }
}

class FakeQdrant {
  constructor() { this.points = new Map(); this.calls = []; this.failDelete = false; }
  async ensureCollection() { this.calls.push('ensure'); }
  async upsert(points) { for (const point of points) this.points.set(point.id, point); this.calls.push(['upsert', points]); }
  async deleteFile(id) { this.calls.push(['delete', id]); for (const [key, point] of this.points) if (point.payload.drive_file_id === id) this.points.delete(key); }
  async deleteFileExcept(id, revision) {
    this.calls.push(['prune', id, revision]);
    if (this.failDelete) { this.failDelete = false; throw new Error('QDRANT_DELETE_FAILED'); }
    for (const [key, point] of this.points) if (point.payload.drive_file_id === id && point.payload.drive_revision !== `${id}:${revision}`) this.points.delete(key);
  }
  async search(vector, limit, active, folderId, embeddingSpace) {
    this.searchArgs = { vector, limit, active, folderId, embeddingSpace };
    return { result: [...this.points.values()].filter((point) => point.payload.folder_id === folderId
      && point.payload.embedding_space === embeddingSpace
      && active.some((doc) => doc.drive_file_id === point.payload.drive_file_id && doc.revision_indexada === point.payload.revision_indexada))
      .map((point) => ({ score: 0.9, payload: point.payload })) };
  }
}

function setup({ files = [makeFile('D01')], text = '## 1. Solicitud de vacaciones\n\n' + 'Contenido de política simulada y procedimiento de solicitud. '.repeat(10) } = {}) {
  const store = new FakeStore(); const drive = new FakeDrive(files); const qdrant = new FakeQdrant();
  const embedded = [];
  const embeddings = { async embed(texts, options) { embedded.push({ texts, options }); return texts.map(() => [0.1, 0.2, 0.3]); } };
  const agent = new IngestionAgent({ config, store, drive, qdrant, embeddings, extract: async () => text });
  return { agent, store, drive, qdrant, embedded };
}

test('carga inicial idempotente indexa secciones y conserva citas trazables', async () => {
  const state = setup();
  const first = await state.agent.sync();
  assert.equal(first.mode, 'initial');
  assert.equal(first.indexed, 1);
  assert.equal(state.drive.starts, 1);
  const points = [...state.qdrant.points.values()];
  assert.equal(points.length, 2);
  const payload = points[0].payload;
  for (const field of ['drive_file_id', 'documento', 'nombre', 'enlace', 'version', 'seccion', 'fragmento_id', 'revision_indexada', 'drive_revision', 'folder_id']) assert.ok(payload[field]);
  assert.equal(payload.estado_documental, 'preparado_simulacion');
  assert.match(payload.enlace, /^https:\/\/drive\.google\.com\//);
  assert.equal(payload.seccion, '1. Solicitud de vacaciones');
  assert.match(points[0].id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal((await state.agent.sync()).mode, 'incremental');
  assert.equal(state.qdrant.points.size, 2);
  assert.equal(state.store.logs.filter((log) => log.status === 'completada').length, 2);
});

test('procesa alta/modificación y reintenta borrado físico parcial antes de avanzar cursor', async () => {
  const state = setup();
  await state.agent.sync();
  const original = [...state.store.docs.values()][0].revision_indexada;
  const pointsPerRevision = [...state.qdrant.points.values()].filter((point) => point.payload.drive_file_id === 'D01').length;
  const changed = makeFile('D01', 'D01 actualizado.pdf', { version: '8', modifiedTime: '2026-11-17T13:00:00.000Z' });
  state.drive.files.set('D01', changed);
  state.drive.pages.push({ changes: [{ fileId: 'D01', file: changed }], newStartPageToken: 'token-2' });
  state.qdrant.failDelete = true;
  await assert.rejects(state.agent.sync(), /QDRANT_DELETE_FAILED/);
  assert.equal(state.store.cursor, 'token-1');
  assert.notEqual(state.store.docs.get('D01').revision_indexada, original);
  state.drive.pages.push({ changes: [{ fileId: 'D01', file: changed }], newStartPageToken: 'token-2' });
  const retried = await state.agent.sync();
  assert.equal(retried.changes.pages, 1);
  assert.equal(state.store.cursor, 'token-2');
  assert.equal([...state.qdrant.points.values()].filter((point) => point.payload.drive_file_id === 'D01').length, pointsPerRevision);
});

test('retira eliminados, movidos y shortcuts, y no extrae archivos ajenos', async () => {
  const first = makeFile('D01'); const state = setup({ files: [first] });
  await state.agent.sync();
  let extracted = 0;
  state.agent.extract = async () => { extracted += 1; return 'Contenido suficientemente largo para indexar este documento de prueba.'; };
  const moved = makeFile('D01', 'D01.pdf', { parents: ['other-folder'] });
  const shortcut = makeFile('D02', 'Acceso directo', { mimeType: 'application/vnd.google-apps.shortcut', shortcutDetails: { targetId: 'outside' } });
  const added = makeFile('D03');
  state.drive.files.set('D01', moved); state.drive.files.set('D02', shortcut); state.drive.files.set('D03', added);
  state.drive.pages.push({ changes: [
    { fileId: 'D01', file: moved }, { fileId: 'D02', file: shortcut }, { fileId: 'D03', file: added },
    { fileId: 'D04', removed: true },
  ], newStartPageToken: 'token-2' });
  const result = await state.agent.sync();
  assert.equal(result.changes.deleted, 1);
  assert.equal(result.changes.skipped, 2);
  assert.equal(result.changes.indexed, 1);
  assert.equal(extracted, 1);
  assert.equal(state.store.docs.get('D01').eliminado, true);
  assert.equal([...state.qdrant.points.values()].some((point) => point.payload.drive_file_id === 'D01'), false);
});

test('no indexa borrador y filtra búsqueda por carpeta/revisión activa con tarea de consulta', async () => {
  const draft = makeFile('D00', 'Borrador.pdf', { properties: {} });
  const file = makeFile('D01'); const state = setup({ files: [draft, file] });
  await state.agent.sync();
  assert.equal(state.store.docs.get('D00').estado_indexacion, 'retirado');
  assert.equal(state.qdrant.points.size, 2);
  const results = await state.agent.search('¿Cómo solicito vacaciones?');
  assert.equal(results.length, 2);
  assert.equal(state.qdrant.searchArgs.folderId, config.folderId);
  assert.equal(state.embedded.at(-1).options.taskType, 'RETRIEVAL_QUERY');
});

test('cursor 410 fuerza snapshot completo bajo la misma exclusión mutua', async () => {
  const state = setup(); await state.agent.sync();
  const error = new Error('HTTP_410'); error.status = 410;
  state.drive.pages.push(error);
  const result = await state.agent.sync();
  assert.equal(result.mode, 'reconciled');
  assert.equal(state.drive.starts, 2);
  assert.equal(state.drive.lists, 2);
  assert.equal(state.store.cursor, 'token-2');
});

test('cada página confirmada conserva su cursor aunque falle la siguiente', async () => {
  const state = setup();
  await state.agent.sync();
  const added = makeFile('D02');
  state.drive.files.set(added.id, added);
  const failure = new Error('HTTP_503');
  failure.status = 503;
  state.drive.pages.push({ changes: [{ fileId: added.id, file: added }], nextPageToken: 'page-2' }, failure);
  await assert.rejects(state.agent.sync(), /HTTP_503/);
  assert.equal(state.store.cursor, 'page-2');
  assert.equal(state.store.docs.get('D02').estado_indexacion, 'indexado');
  state.drive.pages.push({ changes: [{ fileId: 'D01', removed: true }], newStartPageToken: 'token-final' });
  await state.agent.sync();
  assert.equal(state.store.cursor, 'token-final');
  assert.equal(state.store.docs.get('D01').eliminado, true);
  assert.equal(state.store.docs.get('D02').estado_indexacion, 'indexado');
});

test('perder acceso a la carpeta invalida la revisión y exige reconciliación al recuperar permiso', async () => {
  const state = setup();
  await state.agent.sync();
  state.drive.assertAuthorizedFolder = async () => { const error = new Error('HTTP_403'); error.status = 403; throw error; };
  await assert.rejects(state.agent.sync(), /HTTP_403/);
  assert.equal((await state.store.listActiveDocuments()).length, 0);
  assert.equal(state.store.cursor, 'pending');
  state.drive.assertAuthorizedFolder = async () => {};
  await state.agent.sync();
  assert.equal((await state.store.listActiveDocuments()).length, 1);
});

test('no avanza token si un archivo cambia al extraer y procesa solo contenido autorizado', async () => {
  const file = makeFile('D01'); const state = setup({ files: [file] });
  await state.agent.sync();
  const changed = makeFile('D01', 'D01.pdf', { version: '8' });
  state.drive.files.set('D01', changed);
  state.drive.pages.push({ changes: [{ fileId: 'D01', file: changed }], newStartPageToken: 'token-2' });
  state.agent.extract = async (snapshot) => {
    state.drive.files.set(snapshot.id, makeFile('D01', 'D01.pdf', { parents: ['outside'] }));
    return 'Texto suficientemente largo para permitir generar embeddings. '.repeat(3);
  };
  await state.agent.sync();
  assert.equal(state.store.cursor, 'token-2');
  assert.equal(state.store.docs.get('D01').eliminado, true);
});

test('falla cerrada al fallar embeddings de una modificación y conserva cursor para reintento', async () => {
  const file = makeFile('D01'); const state = setup({ files: [file] });
  await state.agent.sync();
  const changed = makeFile('D01', 'D01.pdf', { version: '8', modifiedTime: '2026-11-17T14:00:00.000Z' });
  state.drive.files.set('D01', changed);
  state.drive.pages.push({ changes: [{ fileId: 'D01', file: changed }], newStartPageToken: 'token-2' });
  state.agent.embeddings.embed = async () => { throw new Error('EMBEDDING_UNAVAILABLE'); };
  await assert.rejects(state.agent.sync(), /EMBEDDING_UNAVAILABLE/);
  assert.equal(state.store.cursor, 'token-1');
  assert.equal(state.store.docs.get('D01').estado_indexacion, 'error');
  assert.equal((await state.store.listActiveDocuments()).length, 0);
});

test('lock ocupado rechaza ejecuciones superpuestas', async () => {
  const state = setup(); let release;
  const wait = new Promise((resolve) => { release = resolve; });
  const original = state.store.withLock.bind(state.store);
  let first = true;
  state.store.withLock = async (folder, duration, fn) => {
    if (!first) return { locked: false };
    first = false;
    state.store.locked = true;
    try { await wait; return { locked: true, result: await fn() }; } finally { state.store.locked = false; }
  };
  const running = state.agent.sync();
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(state.agent.sync(), /INGESTION_ALREADY_RUNNING/);
  release();
  await running;
  state.store.withLock = original;
});

test('provider checks exact count, finite dimension, rejects zero vectors; GoogleAuth headers survive', async () => {
  assert.throws(() => validate([[1, 2]], 1, 3), /DIMENSION/);
  assert.throws(() => validate([[0, 0, 0]], 1, 3), /DIMENSION/);
  const client = new EmbeddingClient(config, async () => ({ data: [{ index: 0, embedding: [1, 2, 3] }] }));
  assert.deepEqual(await client.embed(['pregunta']), [[1, 2, 3]]);
  let authorization;
  const drive = new GoogleDriveClient({ folderId: config.folderId, auth: { getClient: async () => ({ getRequestHeaders: async () => new Headers({ Authorization: 'Bearer local-test' }) }) },
    fetcher: async (url, options) => { authorization = new Headers(options.headers).get('Authorization'); return new Response(JSON.stringify({ startPageToken: 'cursor' }), { status: 200 }); } });
  await drive.getStartPageToken();
  assert.equal(authorization, 'Bearer local-test');
});

test('extrae Google Sheets con exceljs en todas sus hojas y encabeza secciones', async () => {
  const ExcelJS = require('exceljs'); const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Calendario').addRow(['Fecha', 'Feriado']);
  workbook.worksheets[0].addRow(['2026-12-25', 'Navidad']);
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  const text = await extractDocument(makeFile('SHEET', 'Feriados', { mimeType: TYPES.sheet }), { exportGoogleSheet: async () => bytes });
  assert.match(text, /Hoja: Calendario/);
  assert.match(text, /2026-12-25 \| Navidad/);
});

test('fragmenta por encabezados numerados, límite, solapamiento e IDs deterministas', () => {
  const chunks = splitDocument('## A\n\n' + 'x '.repeat(800) + '\n## 2. Licencias\n\nTexto. '.repeat(20), { maxChars: 500, overlap: 50 });
  assert.ok(chunks.length > 2);
  assert.ok(chunks.every((part) => part.text.length <= 500));
  assert.ok(chunks.some((part) => part.section === '2. Licencias'));
  assert.equal(pointId('stable'), pointId('stable'));
});
