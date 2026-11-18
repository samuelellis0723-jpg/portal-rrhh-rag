const { createHash, randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const formats = {
  'google-doc': { mime: 'application/vnd.google-apps.document', input: 'text/html' },
  'google-sheet': { mime: 'application/vnd.google-apps.spreadsheet', input: 'text/csv' },
  pdf: { mime: 'application/pdf', input: 'application/pdf' },
};

async function prepareManifest(manifestPath) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const documents = Array.isArray(manifest) ? manifest : manifest.documents;
  if (!Array.isArray(documents) || documents.length < 10) throw new Error('POLICY_MANIFEST_INVALID');
  const directory = path.dirname(manifestPath);
  const ids = new Set();
  const result = [];
  for (const document of documents) {
    const id = document.id;
    const format = formats[document.format];
    const source = document.publish_source || document.export_path || document.source;
    if (!/^D\d{2}$/.test(id) || ids.has(id) || !format || !document.title || !document.version || !source) {
      throw new Error('POLICY_MANIFEST_INVALID');
    }
    ids.add(id);
    const file = path.resolve(directory, source);
    if (!file.startsWith(`${directory}${path.sep}`)) throw new Error('POLICY_SOURCE_OUTSIDE_CORPUS');
    const content = await fs.readFile(file);
    if (!content.length || content.length > 5 * 1024 * 1024) throw new Error('POLICY_SOURCE_SIZE_INVALID');
    result.push({ id, title: document.title, version: document.version, format: document.format,
      mime: format.mime, input: format.input, file, content, checksum: createHash('sha256').update(content).digest('hex') });
  }
  return result;
}

function createPublisher({ client, folderId }) {
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(folderId || '')) throw new Error('DRIVE_FOLDER_NOT_CONFIGURED');
  async function request(url, options = {}) {
    try {
      const response = await client.request({ url, timeout: 30000, ...options });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      throw new Error(status === 401 || status === 403 ? 'DRIVE_ACCESS_DENIED' : `DRIVE_REQUEST_FAILED${status ? `_${status}` : ''}`);
    }
  }
  async function folder() {
    const data = await request(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
      params: { fields: 'id,mimeType,trashed,capabilities(canAddChildren)', supportsAllDrives: true },
    });
    if (data.id !== folderId || data.mimeType !== FOLDER_MIME || data.trashed) throw new Error('DRIVE_FOLDER_INVALID');
    return data;
  }
  async function inspect() {
    await folder();
    const files = [];
    let pageToken;
    do {
      const data = await request('https://www.googleapis.com/drive/v3/files', { params: {
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType,parents,webViewLink,appProperties,properties)',
        pageSize: 100, pageToken, includeItemsFromAllDrives: true, supportsAllDrives: true,
      } });
      files.push(...data.files);
      pageToken = data.nextPageToken;
    } while (pageToken);
    return files;
  }
  async function publish(documents) {
    const info = await folder();
    if (!info.capabilities?.canAddChildren) throw new Error('DRIVE_FOLDER_NOT_WRITABLE');
    const files = await inspect();
    const results = [];
    for (const document of documents) {
      const matches = files.filter((file) => (file.properties?.bosque_claro_document_id || file.appProperties?.bosque_claro_document_id) === document.id);
      if (matches.length > 1) throw new Error('DRIVE_MANAGED_DOCUMENT_DUPLICATED');
      const existing = matches[0];
      if (!existing && files.some((file) => file.name === document.title)) throw new Error('DRIVE_UNMANAGED_NAME_CONFLICT');
      if (existing && existing.mimeType !== document.mime) throw new Error('DRIVE_MANAGED_FORMAT_CONFLICT');
      const properties = {
        bosque_claro_document_id: document.id,
        bosque_claro_version: document.version,
        bosque_claro_estado: 'preparado_simulacion',
        bosque_claro_checksum: document.checksum,
      };
      if (existing && (existing.properties?.bosque_claro_checksum || existing.appProperties?.bosque_claro_checksum) === document.checksum) {
        results.push({ document_id: document.id, action: 'unchanged', drive_file_id: existing.id, enlace: existing.webViewLink });
        continue;
      }
      if (existing) {
        const current = await request(`https://www.googleapis.com/drive/v3/files/${existing.id}`, {
          params: { fields: 'id,parents,trashed', supportsAllDrives: true },
        });
        if (current.trashed || !current.parents?.includes(folderId)) throw new Error('DRIVE_FILE_OUTSIDE_FOLDER');
      }
      const metadata = { name: document.title, mimeType: document.mime, properties,
        ...(existing ? {} : { parents: [folderId] }) };
      const boundary = `bosque_claro_${randomBytes(16).toString('hex')}`;
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${document.input}\r\n\r\n`),
        document.content, Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const uploaded = await request(`https://www.googleapis.com/upload/drive/v3/files${existing ? `/${existing.id}` : ''}`, {
        method: existing ? 'PATCH' : 'POST', data: body,
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        params: { uploadType: 'multipart', fields: 'id,name,mimeType,parents,webViewLink', supportsAllDrives: true },
      });
      if (!uploaded.parents?.includes(folderId) || uploaded.mimeType !== document.mime) throw new Error('DRIVE_UPLOAD_VERIFICATION_FAILED');
      results.push({ document_id: document.id, action: existing ? 'updated' : 'created', drive_file_id: uploaded.id, enlace: uploaded.webViewLink });
    }
    return results;
  }
  return { inspect, publish };
}

module.exports = { prepareManifest, createPublisher };
