const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { prepareManifest } = require('../src/services/policy-publisher');
const { extractDocument, TYPES } = require('../src/integrations/document-extractor');

const corpus = path.resolve(__dirname, '../../docs/politicas');

test('el corpus local tiene doce documentos editables y artefactos para los tres formatos', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(corpus, 'manifest.json'), 'utf8'));
  const docs = manifest.documents;
  assert.equal(docs.length, 12);
  assert.deepEqual(docs.map((doc) => doc.id), Array.from({ length: 12 }, (_, index) => `D${String(index + 1).padStart(2, '0')}`));
  const prepared = await prepareManifest(path.join(corpus, 'manifest.json'));
  assert.equal(prepared.filter((doc) => doc.format === 'google-doc').length, 9);
  assert.equal(prepared.filter((doc) => doc.format === 'google-sheet').length, 2);
  assert.equal(prepared.filter((doc) => doc.format === 'pdf').length, 1);
  for (const doc of docs) {
    assert.ok(doc.title && doc.version && doc.fecha && doc.responsable && doc.section);
    const source = await fs.readFile(path.join(corpus, doc.source), 'utf8');
    assert.ok(source.length > 500, `${doc.id}: fuente sustancial`);
    assert.ok(source.includes('2026-11-17'), `${doc.id}: fecha documental`);
    assert.equal(source.includes('ID_DRIVE_PENDIENTE'), false);
    if (doc.source.endsWith('.md')) {
      assert.ok((source.match(/^#{1,3} /gm) || []).length >= (doc.format === 'google-sheet' ? 2 : 4), `${doc.id}: secciones`);
      assert.match(source, /propuest|académic/i);
    } else {
      assert.match(source, /Versión/);
      assert.match(source, /Responsable/);
    }
  }
});

test('el PDF de incapacidades contiene texto extraíble y no es una integración simulada de Drive', async () => {
  const pdf = await fs.readFile(path.join(corpus, 'pdf/D04-incapacidades.pdf'));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const text = await extractDocument({ id: 'local_pdf_test', mimeType: TYPES.pdf }, { download: async () => pdf });
  assert.ok(text.length > 1000);
  assert.match(text, /incapacidades/i);
  assert.match(text, /CCSS/);
  assert.match(text, /INS/);
});
