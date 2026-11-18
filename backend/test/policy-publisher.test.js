const test = require('node:test');
const assert = require('node:assert/strict');
const { createPublisher } = require('../src/services/policy-publisher');

const folderId = 'authorized_folder_123';
const doc = { id: 'D01', title: 'Vacaciones — prueba', version: '0.1', format: 'google-doc',
  mime: 'application/vnd.google-apps.document', input: 'text/html', content: Buffer.from('<h1>Vacaciones</h1>'), checksum: 'checksum-local-prueba' };

function fakeDrive(initial = []) {
  const files = structuredClone(initial);
  let uploads = 0;
  const client = { async request({ url, params, method, data }) {
    if (url.includes('/upload/')) {
      uploads += 1;
      const metadata = JSON.parse(data.toString().split('\r\n\r\n')[1].split('\r\n--')[0]);
      if (method === 'PATCH') {
        const id = url.split('/').at(-1);
        const file = files.find((file) => file.id === id);
        Object.assign(file, metadata);
        return { data: file };
      }
      const file = { ...metadata, id: 'created_file_123', webViewLink: 'https://drive.google.com/file/d/created_file_123/view' };
      files.push(file);
      return { data: file };
    }
    if (url.endsWith(`/${folderId}`)) return { data: { id: folderId, mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } } };
    if (url.endsWith('/files')) {
      assert.equal(params.q, `'${folderId}' in parents and trashed = false`);
      return { data: { files } };
    }
    const file = files.find((file) => url.endsWith(`/${file.id}`));
    assert.ok(file);
    return { data: file };
  } };
  return { publisher: createPublisher({ client, folderId }), files, uploads: () => uploads };
}

test('publicación convierte al MIME nativo y repetirla no duplica ni cambia archivos', async () => {
  const drive = fakeDrive();
  const first = await drive.publisher.publish([doc]);
  assert.equal(first[0].action, 'created');
  assert.equal(drive.files[0].mimeType, 'application/vnd.google-apps.document');
  assert.deepEqual(drive.files[0].parents, [folderId]);
  assert.equal(drive.files[0].properties.bosque_claro_estado, 'preparado_simulacion');
  const second = await drive.publisher.publish([doc]);
  assert.equal(second[0].action, 'unchanged');
  assert.equal(drive.uploads(), 1);
  assert.equal(drive.files.length, 1);
});

test('actualizar una fuente preserva su ID y rechaza colisiones no administradas', async () => {
  const drive = fakeDrive();
  await drive.publisher.publish([doc]);
  const updated = await drive.publisher.publish([{ ...doc, checksum: 'otra-revision-local', version: '0.2' }]);
  assert.equal(updated[0].action, 'updated');
  assert.equal(updated[0].drive_file_id, 'created_file_123');
  const collision = fakeDrive([{ id: 'foreign-file', name: doc.title, parents: [folderId] }]);
  await assert.rejects(collision.publisher.publish([doc]), /DRIVE_UNMANAGED_NAME_CONFLICT/);
  assert.equal(collision.uploads(), 0);
});

test('no se actualiza un archivo retirado de la carpeta durante la publicación', async () => {
  const file = { id: 'existing_file_123', name: doc.title, mimeType: doc.mime, parents: ['otra_carpeta'],
    properties: { bosque_claro_document_id: 'D01', bosque_claro_checksum: 'anterior' } };
  const drive = fakeDrive([file]);
  await assert.rejects(drive.publisher.publish([doc]), /DRIVE_FILE_OUTSIDE_FOLDER/);
  assert.equal(drive.uploads(), 0);
});
