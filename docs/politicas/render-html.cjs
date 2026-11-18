const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const destinations = {
  'D01-vacaciones.md': 'google-docs/D01-vacaciones.html',
  'D03-permisos-licencias.md': 'google-docs/D03-permisos-licencias.html',
  'D04-incapacidades.md': 'pdf/D04-incapacidades.html',
  'D05-jornada-teletrabajo.md': 'google-docs/D05-jornada-teletrabajo.html',
  'D06-politica-salarial.md': 'google-docs/D06-politica-salarial.html',
  'D08-beneficios.md': 'google-docs/D08-beneficios.html',
  'D09-ingreso-salida.md': 'google-docs/D09-ingreso-salida.html',
  'D10-desempeno.md': 'google-docs/D10-desempeno.html',
  'D11-conducta-denuncias.md': 'google-docs/D11-conducta-denuncias.html',
  'D12-privacidad.md': 'google-docs/D12-privacidad.html',
};
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1">$1</a>');
}
function render(md) {
  const lines = md.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').split(/\r?\n/);
  const out = [];
  let list = false, para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  for (const line of lines) {
    if (!line.trim()) { flush(); if (list) { out.push('</ul>'); list = false; } continue; }
    const h = line.match(/^(#{1,3})\s+(.+)/);
    const li = line.match(/^[-*]\s+(.+)/);
    if (h) { flush(); if (list) { out.push('</ul>'); list = false; } const n = h[1].length; out.push(`<h${n}>${inline(h[2])}</h${n}>`); }
    else if (li) { flush(); if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(li[1])}</li>`); }
    else para.push(line.trim());
  }
  flush(); if (list) out.push('</ul>');
  return out.join('\n');
}
for (const [source, destination] of Object.entries(destinations)) {
  const md = fs.readFileSync(path.join(root, source), 'utf8');
  const metadata = Object.fromEntries([...md.matchAll(/^([a-z_]+):\s*"?([^"\n]+)"?$/gm)].map((match) => [match[1], match[2]]));
  const title = metadata.title || source.replace(/^D\d+-/, '').replace(/\.md$/, '').replaceAll('-', ' ');
  const metaBlock = `<div class="meta"><strong>Versión:</strong> ${esc(metadata.version || '0.1')} · <strong>Responsable:</strong> ${esc(metadata.responsable || '')} · <strong>Fecha:</strong> ${esc(metadata.fecha || '2026-11-17')}<br><strong>Vigencia propuesta:</strong> ${esc(metadata.vigencia_propuesta || '2026-11-17 (solo simulación; sin adopción empresarial)')}<br><strong>Estado:</strong> ${esc(metadata.estado || 'borrador académico no aprobado')}</div>`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:11pt/1.55 Arial,sans-serif;color:#24312c;max-width:760px;margin:38px auto;padding:0 28px}h1,h2,h3{color:#174b3a;line-height:1.25}h1{font-size:24pt;border-bottom:2px solid #d8e3dc;padding-bottom:10px}h2{font-size:16pt;margin-top:25px}a{color:#17634b;overflow-wrap:anywhere}li{margin:5px 0}.meta{background:#f1f5f2;padding:14px 18px;border-left:4px solid #52856d;margin:12px 0 20px}.document-title{font-size:27pt;margin:0 0 16px}</style></head><body><h1 class="document-title">${esc(title)}</h1>${metaBlock}${render(md)}</body></html>`;
  fs.writeFileSync(path.join(root, destination), html);
}
