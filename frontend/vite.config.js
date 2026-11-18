import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const origin = 'http://localhost:5173';
  if (command === 'serve') {
    let backend = {};
    try { backend = parseEnv(readFileSync(new URL('../backend/.env', import.meta.url), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const allowed = (process.env.ALLOWED_ORIGINS || backend.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
    if (!allowed.includes(origin)) {
      throw new Error(`Vite necesita ${origin} en ALLOWED_ORIGINS del backend. Revisa la configuración sin reemplazar las credenciales existentes.`);
    }
  }
  const proxy = { '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:3001', changeOrigin: false } };
  return {
    plugins: [react()],
    server: { host: 'localhost', port: 5173, strictPort: true, proxy },
    preview: { host: 'localhost', port: 5173, strictPort: true, proxy },
  };
});
