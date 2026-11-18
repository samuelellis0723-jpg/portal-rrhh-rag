// Reutiliza un login path local. Solo captura su salida en memoria; nunca imprime secretos.
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const envPath = path.resolve(__dirname, '../.env');
const loginPath = process.argv[2];
const replace = process.argv.includes('--replace-db-credentials');

try {
  if (!loginPath || loginPath.startsWith('-')) throw new Error('Indica un login path local.');
  if (fs.existsSync(envPath) && !replace) throw new Error('backend/.env ya existe y se conserva.');
  const output = execFileSync('my_print_defaults', [`--login-path=${loginPath}`, '--show', 'client'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const options = {};
  for (const line of output.split('\n')) {
    const match = line.match(/^--([^=]+)=(.*)$/);
    if (match) options[match[1]] = match[2];
  }
  if (!options.user || !options.password || options.password === '*****') {
    throw new Error('El perfil no contiene usuario y contraseña utilizables. Configura .env manualmente.');
  }
  const secret = Buffer.from(options.password, 'utf8').toString('base64');
  const connection = {
    DB_HOST: options.host === 'localhost' ? '127.0.0.1' : options.host || '127.0.0.1',
    DB_PORT: options.port || '3306', DB_USER: options.user, DB_PASSWORD_BASE64: secret,
    DB_MIGRATION_USER: options.user, DB_MIGRATION_PASSWORD_BASE64: secret,
  };
  const prior = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split('\n') : [
    'NODE_ENV=development', 'HOST=127.0.0.1', 'PORT=3001', 'DB_NAME=bosque_claro_dev',
    'DB_TEST_NAME=bosque_claro_test', 'DB_CONNECT_TIMEOUT_MS=5000',
    `DEMO_COLABORADOR_PASSWORD=${randomBytes(18).toString('hex')}`,
    `DEMO_RRHH_PASSWORD=${randomBytes(18).toString('hex')}`,
    `CSRF_SECRET=${randomBytes(32).toString('hex')}`, 'ALLOWED_ORIGINS=http://localhost:5173',
  ];
  const keys = new Set([...Object.keys(connection), 'DB_PASSWORD', 'DB_MIGRATION_PASSWORD']);
  const lines = prior.filter((line) => line && !keys.has(line.split('=')[0]));
  lines.push(...Object.entries(connection).map(([key, value]) => `${key}=${value}`));
  fs.writeFileSync(envPath, `${lines.join('\n')}\n`, { mode: 0o600 });
  fs.chmodSync(envPath, 0o600);
  console.log('Conexión local reutilizada en .env (0600), sin mostrar secretos ni cambiar permisos MySQL.');
} catch (error) {
  console.error(error.stderr ? 'No se pudo leer el perfil MySQL. Configura backend/.env manualmente.' : error.message);
  process.exitCode = 1;
}
