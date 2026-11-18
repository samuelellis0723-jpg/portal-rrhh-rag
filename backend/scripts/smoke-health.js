const { spawn } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
require('../src/config/env');

async function main() {
  const server = spawn(process.execPath, [path.resolve(__dirname, '../src/server.js')], {
    env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Solo aceptar el mensaje de arranque; no reenviar stderr o contenido de la conexión.
  const timer = setTimeout(() => server.kill('SIGTERM'), 15000);
  try {
    const port = await new Promise((resolve, reject) => {
      server.stdout.on('data', (chunk) => {
        const match = chunk.toString().match(/puerto (\d+)/);
        if (match) resolve(Number(match[1]));
      });
      server.once('error', reject);
      server.once('exit', () => reject(new Error('El servidor no inició.')));
    });
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, { data: { status: 'ok', database: 'up' } });
    console.log(JSON.stringify({ startup: 'ok', endpoint: '/api/v1/health', http_status: response.status, ...body }));
  } finally {
    clearTimeout(timer);
    server.kill('SIGTERM');
  }
}

main().catch(() => {
  console.error('Smoke falló: revisar configuración de puerto/MySQL. No se mostraron secretos.');
  process.exitCode = 1;
});
