const test = require('node:test');
const assert = require('node:assert/strict');
const { QdrantClient } = require('../src/integrations/qdrant');
const { EmbeddingClient } = require('../src/integrations/embeddings');
const { GoogleDriveClient } = require('../src/integrations/google-drive');

test('el filtro REST de limpieza conserva la revisión nueva y archivos ajenos', async () => {
  const points = [
    { drive_file_id: 'file-1', drive_revision: 'file-1:old' },
    { drive_file_id: 'file-1', drive_revision: 'file-1:new' },
    { drive_file_id: 'file-2', drive_revision: 'file-2:old' },
  ];
  let remaining;
  const client = new QdrantClient({ qdrantUrl: 'https://qdrant.example', collection: 'test' }, async (url, options) => {
    assert.ok(url.endsWith('/points/delete?wait=true'));
    const { filter } = JSON.parse(options.body);
    const condition = (point, expression) => {
      const value = point[expression.key];
      if (expression.match?.value !== undefined) return value === expression.match.value;
      if (expression.match?.except) return !expression.match.except.includes(value);
      if (expression.match?.any) return expression.match.any.includes(value);
      throw new Error('Filtro no contemplado por el verificador.');
    };
    remaining = points.filter((point) => !(
      (filter.must || []).every((item) => condition(point, item))
      && !(filter.must_not || []).some((item) => condition(point, item))
    ));
    return { status: 'ok', result: { status: 'completed' } };
  });
  await client.deleteFileExcept('file-1', 'new');
  assert.deepEqual(remaining, points.slice(1));
});

test('Gemini recibe el secreto en header y distingue documento de consulta', async () => {
  const calls = [];
  const client = new EmbeddingClient({ embeddingProvider: 'gemini', embeddingModel: 'gemini-embedding-001',
    embeddingApiKey: 'clave-sintetica-de-prueba', embeddingDimension: 3 }, async (url, options) => {
    assert.equal(url.includes('clave-sintetica'), false);
    assert.equal(options.headers['x-goog-api-key'], 'clave-sintetica-de-prueba');
    const payload = JSON.parse(options.body);
    calls.push(payload.requests[0]);
    return { embeddings: [{ values: [0.1, 0.2, 0.3] }] };
  });
  await client.embed(['Política de vacaciones en español.']);
  await client.embed(['¿Cómo solicito vacaciones?'], { taskType: 'RETRIEVAL_QUERY' });
  assert.equal(calls[0].taskType, 'RETRIEVAL_DOCUMENT');
  assert.equal(calls[1].taskType, 'RETRIEVAL_QUERY');
  assert.ok(calls.every((request) => request.outputDimensionality === 3));
});

test('Qdrant no confirma escrituras vacías o solamente aceptadas', async () => {
  for (const response of [null, {}, { status: 'ok', result: { status: 'acknowledged' } }]) {
    const client = new QdrantClient({ qdrantUrl: 'https://qdrant.example', collection: 'test' }, async () => response);
    await assert.rejects(client.upsert([{ id: 'test' }]), /QDRANT_WRITE_NOT_CONFIRMED/);
    await assert.rejects(client.deleteFile('test'), /QDRANT_WRITE_NOT_CONFIRMED/);
  }
});

test('la descarga se corta al exceder el límite aunque no haya Content-Length', async () => {
  let cancelled = false;
  const client = new GoogleDriveClient({ folderId: 'test-folder', maxDownloadBytes: 3,
    auth: { getClient: async () => ({ getRequestHeaders: async () => new Headers() }) },
    fetcher: async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array([1, 2, 3, 4])); },
      cancel() { cancelled = true; },
    }), { status: 200 }) });
  await assert.rejects(client.download('file-test'), /DRIVE_FILE_TOO_LARGE/);
  assert.equal(cancelled, true);
});

test('el acceso al folder se comprueba antes de tratar un listado vacío como válido', async () => {
  const client = new GoogleDriveClient({ folderId: 'test-folder', auth: {
    getClient: async () => ({ getRequestHeaders: async () => new Headers() }),
  }, fetcher: async () => new Response(JSON.stringify({ id: 'test-folder', mimeType: 'application/pdf' }), { status: 200 }) });
  await assert.rejects(client.assertAuthorizedFolder(), /DRIVE_AUTHORIZED_FOLDER_INVALID/);
});
