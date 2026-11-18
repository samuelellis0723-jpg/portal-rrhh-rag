const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../frontend/node_modules/playwright');

const source = path.resolve(__dirname, '../investigacion-politicas.md');
const outHtml = path.resolve(__dirname, '../investigacion-politicas.html');
const outPdf = path.resolve(__dirname, '../investigacion-politicas.pdf');
const md = fs.readFileSync(source, 'utf8');
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/(https?:\/\/[^\s|)]+)/g, '<a href="$1">$1</a>');
}
function body(lines) {
  const out = [];
  let p = [], ul = false, table = [];
  const flush = () => { if (p.length) { out.push(`<p>${inline(p.join(' '))}</p>`); p = []; } };
  const endList = () => { if (ul) { out.push('</ul>'); ul = false; } };
  const endTable = () => {
    if (!table.length) return;
    const rows = table.filter((x) => !/^\|?\s*:?-{3,}/.test(x));
    out.push('<table>');
    rows.forEach((row, i) => {
      const cells = row.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
      out.push(`<tr>${cells.map((x) => i === 0 ? `<th>${inline(x)}</th>` : `<td>${inline(x)}</td>`).join('')}</tr>`);
    });
    out.push('</table>'); table = [];
  };
  for (const line of lines) {
    if (/^\|/.test(line.trim())) { flush(); endList(); table.push(line); continue; }
    endTable();
    if (!line.trim()) { flush(); endList(); continue; }
    const h = line.match(/^(#{1,3})\s+(.+)/), li = line.match(/^[-*]\s+(.+)/);
    if (h) { flush(); endList(); const n = h[1].length; out.push(`<h${n}>${inline(h[2])}</h${n}>`); }
    else if (li) { flush(); if (!ul) { out.push('<ul>'); ul = true; } out.push(`<li>${inline(li[1])}</li>`); }
    else p.push(line.trim());
  }
  flush(); endList(); endTable();
  return out.join('\n');
}
const parts = md.split(/(?=^## \d+\.)/m);
const pages = parts.map((part) => body(part.split(/\r?\n/)));
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Investigación de políticas · Bosque Claro</title><style>@page{size:A4;margin:17mm 18mm}*{box-sizing:border-box}body{font:10.3pt/1.43 Arial,sans-serif;color:#26352f;margin:0}.page{page-break-after:always;min-height:260mm;position:relative}.page:last-child{page-break-after:auto}h1{font-size:23pt;color:#174b3a;border-bottom:2px solid #bacfc2;padding-bottom:9px;margin:0 0 12px}h2{font-size:17pt;line-height:1.18;color:#174b3a;margin:0 0 16px}h3{font-size:12pt;color:#25634e;margin:15px 0 7px}p{margin:0 0 10px}ul{margin:4px 0 12px;padding-left:20px}li{margin:4px 0}table{width:100%;border-collapse:collapse;font-size:8.2pt;line-height:1.25}th,td{border:1px solid #bdcbc2;padding:5px;vertical-align:top}th{background:#eef4f0;text-align:left}a{color:#145d48;overflow-wrap:anywhere}.page:after{content:'Bosque Claro · investigación documental · 17-11-2026';position:absolute;bottom:0;left:0;font-size:8pt;color:#68756e}</style></head><body>${pages.map((x) => `<section class="page">${x}</section>`).join('')}</body></html>`;
fs.writeFileSync(outHtml, html);
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${outHtml}`, { waitUntil: 'load' });
    await page.pdf({ path: outPdf, format: 'A4', printBackground: true });
  } finally { await browser.close(); }
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
