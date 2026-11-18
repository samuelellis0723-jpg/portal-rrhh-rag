const path = require('node:path');
require('../src/config/env');
const { GoogleAuth } = require('google-auth-library');
const { prepareManifest, createPublisher } = require('../src/services/policy-publisher');

async function main() {
  const mode = process.argv[2] || '--plan';
  if (!['--plan', '--inspect', '--apply'].includes(mode)) throw new Error('USAGE: --plan | --inspect | --apply');
  if (mode === '--plan') {
    const documents = await prepareManifest(path.resolve(__dirname, '../../docs/politicas/manifest.json'));
    console.log(JSON.stringify({ mode: 'local_plan', remote_verified: false,
      documents: documents.map(({ id, title, format, version }) => ({ id, title, format, version })) }, null, 2));
    return;
  }
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(process.env.GOOGLE_DRIVE_FOLDER_ID || '')) throw new Error('GOOGLE_DRIVE_FOLDER_ID_REQUIRED');
  const keyFile = mode === '--apply' ? process.env.GOOGLE_PUBLISH_APPLICATION_CREDENTIALS : process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (mode === '--apply' && !keyFile) throw new Error('GOOGLE_PUBLISH_APPLICATION_CREDENTIALS_REQUIRED');
  const auth = new GoogleAuth({ ...(keyFile ? { keyFile } : {}), scopes: mode === '--apply'
    ? ['https://www.googleapis.com/auth/drive'] : ['https://www.googleapis.com/auth/drive.readonly'] });
  const client = await auth.getClient();
  const publisher = createPublisher({ client, folderId: process.env.GOOGLE_DRIVE_FOLDER_ID });
  if (mode === '--inspect') {
    const files = await publisher.inspect();
    console.log(JSON.stringify({ remote_verified: true, files: files.map(({ id, name, mimeType, webViewLink }) => ({ id, name, mime_type: mimeType, enlace: webViewLink })) }, null, 2));
  } else {
    const documents = await prepareManifest(path.resolve(__dirname, '../../docs/politicas/manifest.json'));
    console.log(JSON.stringify({ remote_verified: true, files: await publisher.publish(documents) }, null, 2));
  }
}

main().catch((error) => {
  const code = /^[A-Z_0-9 :|\-]+$/.test(error.message) ? error.message : 'POLICY_PUBLISH_FAILED';
  console.error(JSON.stringify({ error: code, remote_verified: false }));
  process.exitCode = 1;
});
