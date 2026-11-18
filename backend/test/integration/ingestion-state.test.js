const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const store = require('../../src/repositories/drive-ingestion-repository');
const { DriveSyncState, DriveDocumento, sequelize } = require('../../src/models');

test.after(() => sequelize.close());

test('MySQL persiste el cursor de prueba y excluye sincronizaciones concurrentes', async () => {
  const folder = `test_ingest_${randomUUID()}`;
  try {
    const result = await store.withLock(folder, 60000, async () => {
      const active = await store.getState(folder);
      assert.equal(active.estado, 'sincronizando');
      assert.ok(active.bloqueo_hasta > new Date());
      let nestedRan = false;
      const nested = await store.withLock(folder, 60000, async () => { nestedRan = true; });
      assert.equal(nested.locked, false);
      assert.equal(nestedRan, false);
      await store.setCursor(folder, 'cursor_exclusivo_de_prueba');
      return 'persistido';
    });
    assert.deepEqual(result, { locked: true, result: 'persistido' });
    const persisted = await DriveSyncState.findOne({ where: { carpeta_drive_id: folder } });
    assert.equal(persisted.page_token, 'cursor_exclusivo_de_prueba');
    assert.equal(persisted.bloqueo_hasta, null);
    assert.equal((await store.withLock(folder, 60000, async () => 'segunda')).locked, true);
  } finally {
    await DriveSyncState.destroy({ where: { carpeta_drive_id: folder } });
  }
});

test('el bloqueo se libera tras un fallo y el catálogo retira una revisión sin borrar otras filas', async () => {
  const folder = `test_ingest_${randomUUID()}`;
  const id = `test_file_${randomUUID()}`;
  try {
    await assert.rejects(store.withLock(folder, 60000, async () => { throw new Error('TEST_EXPECTED_FAILURE'); }), /TEST_EXPECTED_FAILURE/);
    assert.equal((await store.getState(folder)).bloqueo_hasta, null);
    assert.equal((await store.getState(folder)).estado, 'error');
    assert.equal((await store.getState(folder)).ultimo_error, 'TEST_EXPECTED_FAILURE');
    assert.equal((await store.withLock(folder, 60000, async () => true)).locked, true);
    // Metadatos sintéticos para probar únicamente persistencia, no evidencia de Drive real.
    const file = { id, name: 'Documento sintético de prueba del repositorio', mimeType: 'application/pdf',
      modifiedTime: new Date().toISOString(), webViewLink: `https://drive.google.com/file/d/${id}/view` };
    await store.saveIndexedDocument(file, { version: 'test', checksum: '0'.repeat(64), revision: 'revision_de_prueba' });
    const saved = await DriveDocumento.findOne({ where: { drive_file_id: id } });
    assert.equal(saved.revision_indexada, 'revision_de_prueba');
    assert.equal(saved.estado_indexacion, 'indexado');
    await store.markDeleted(id);
    const retired = await saved.reload();
    assert.equal(retired.eliminado, true);
    assert.equal(retired.revision_indexada, null);
    assert.equal(retired.estado_indexacion, 'retirado');
  } finally {
    await DriveDocumento.destroy({ where: { drive_file_id: id } });
    await DriveSyncState.destroy({ where: { carpeta_drive_id: folder } });
  }
});
