const { GoogleAuth } = require('google-auth-library');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const FILE_FIELDS = 'id,name,mimeType,modifiedTime,webViewLink,parents,version,trashed,shortcutDetails(targetId,targetMimeType),properties,appProperties';
const FIELDS = `files(${FILE_FIELDS}),nextPageToken`;

class GoogleDriveClient {
  constructor({ folderId, credentialsPath, auth, fetcher = fetch, maxDownloadBytes = 20 * 1024 * 1024, timeoutMs = 45000 }) {
    this.folderId = folderId;
    this.auth = auth || new GoogleAuth({ scopes: [DRIVE_SCOPE], ...(credentialsPath ? { keyFile: credentialsPath } : {}) });
    this.fetcher = fetcher;
    this.maxDownloadBytes = maxDownloadBytes;
    this.timeoutMs = timeoutMs;
  }

  async headers() {
    const client = await this.auth.getClient();
    const headers = await client.getRequestHeaders();
    return headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
  }

  async api(path, options = {}) {
    const headers = await this.headers();
    const response = await this.fetcher(`https://www.googleapis.com/drive/v3${path}`, { ...options, signal: options.signal || AbortSignal.timeout(this.timeoutMs), headers: { ...headers, ...options.headers } });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    if (!response.ok) { const error = new Error(`HTTP_${response.status}`); error.status = response.status; throw error; }
    return body;
  }

  async raw(url, accept = 'text/plain') {
    const headers = { ...(await this.headers()), Accept: accept };
    const response = await this.fetcher(url, { headers, signal: AbortSignal.timeout(this.timeoutMs) });
    if (!response.ok) { const error = new Error(`DRIVE_HTTP_${response.status}`); error.status = response.status; throw error; }
    const length = Number(response.headers.get('content-length') || 0);
    if (length > this.maxDownloadBytes) {
      await response.body?.cancel();
      throw new Error('DRIVE_FILE_TOO_LARGE');
    }
    const chunks = [];
    let size = 0;
    const reader = response.body?.getReader();
    if (!reader) throw new Error('DOCUMENT_TEXT_EMPTY');
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > this.maxDownloadBytes) {
          await reader.cancel();
          throw new Error('DRIVE_FILE_TOO_LARGE');
        }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks, size);
  }

  async assertAuthorizedFolder() {
    const folder = await this.getFile(this.folderId);
    if (folder.id !== this.folderId || folder.mimeType !== 'application/vnd.google-apps.folder' || folder.trashed) {
      throw new Error('DRIVE_AUTHORIZED_FOLDER_INVALID');
    }
  }

  async getStartPageToken() {
    const result = await this.api('/changes/startPageToken?supportsAllDrives=true');
    if (!result?.startPageToken) throw new Error('DRIVE_START_TOKEN_MISSING');
    return result.startPageToken;
  }

  async listFolderFiles() {
    const files = [];
    let pageToken;
    do {
      const params = new URLSearchParams({ q: `'${this.folderId}' in parents and trashed = false`,
        pageSize: '1000', fields: FIELDS, supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
      if (pageToken) params.set('pageToken', pageToken);
      const page = await this.api(`/files?${params}`);
      files.push(...(page.files || []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return files;
  }

  async listChanges(pageToken) {
    const params = new URLSearchParams({ pageToken, pageSize: '1000', fields: `nextPageToken,newStartPageToken,changes(fileId,removed,file(${FILE_FIELDS}))`,
      supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', includeRemoved: 'true' });
    const page = await this.api(`/changes?${params}`);
    return { changes: page.changes || [], nextPageToken: page.nextPageToken, newStartPageToken: page.newStartPageToken };
  }

  async getFile(fileId) {
    const params = new URLSearchParams({ fields: FILE_FIELDS, supportsAllDrives: 'true' });
    return this.api(`/files/${encodeURIComponent(fileId)}?${params}`);
  }

  async exportGoogleDoc(fileId) {
    return this.raw(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text%2Fplain`, 'text/plain');
  }

  async exportGoogleSheet(fileId) {
    return this.raw(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  async download(fileId) {
    return this.raw(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, 'application/octet-stream');
  }
}

module.exports = { GoogleDriveClient, DRIVE_SCOPE };
