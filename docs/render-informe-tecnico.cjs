const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../frontend/node_modules/playwright');

const source = path.join(__dirname, 'informe-tecnico.md');
const htmlPath = path.join(__dirname, 'informe-tecnico.html');
const pdfPath = path.join(__dirname, 'informe-tecnico.pdf');
const markdown = fs.readFileSync(source, 'utf8');
const pages = markdown.split(/<!--\s*pagebreak\s*-->/i).map((page) => page.trim()).filter(Boolean);
if (pages.length < 8 || pages.length > 12) throw new Error(`El informe debe tener 8–12 secciones de página; hay ${pages.length}.`);

const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function inline(value) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderPage(markdownPage) {
  const lines = markdownPage.split(/\r?\n/);
  const output = [];
  let paragraph = [];
  let listType = null;
  let tableLines = [];
  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listType) output.push(`</${listType}>`);
    listType = null;
  };
  const closeTable = () => {
    if (!tableLines.length) return;
    const rows = tableLines.filter((line) => !/^\|?\s*:?-{3,}/.test(line));
    output.push('<table>');
    rows.forEach((row, rowIndex) => {
      const cells = row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      const cellTag = rowIndex === 0 ? 'th' : 'td';
      output.push(`<tr>${cells.map((cell) => `<${cellTag}>${inline(cell)}</${cellTag}>`).join('')}</tr>`);
    });
    output.push('</table>');
    tableLines = [];
  };

  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      flushParagraph(); closeList(); tableLines.push(line); continue;
    }
    closeTable();
    if (!line.trim()) { flushParagraph(); closeList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) { closeList(); listType = nextType; output.push(`<${listType}>`); }
      output.push(`<li>${inline((unordered || ordered)[1])}</li>`);
    } else paragraph.push(line.trim());
  }
  flushParagraph(); closeList(); closeTable();
  return output.join('\n');
}

const title = 'Informe técnico · Portal RRHH Bosque Claro';
const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><style>
@page{size:A4;margin:14mm 16mm 18mm}
*{box-sizing:border-box}
html{color:#202b27;background:#fff}
body{font:10pt/1.34 Arial,Helvetica,sans-serif;margin:0;color:#283630}
.page{position:relative;min-height:260mm;padding-bottom:10mm;page-break-after:always;break-after:page;break-inside:avoid}
.page:last-child{page-break-after:auto;break-after:auto}
h1{font-size:19pt;line-height:1.15;color:#174b3a;margin:0 0 13pt;padding:0 0 7pt;border-bottom:1.5pt solid #b8cbbf}
h2{font-size:12pt;color:#23614c;margin:13pt 0 5pt;line-height:1.2}
h3{font-size:10.5pt;color:#23614c;margin:10pt 0 4pt}
p{margin:0 0 8pt;orphans:3;widows:3}
ul,ol{margin:2pt 0 9pt;padding-left:20pt}
li{margin:2pt 0}
strong{color:#1c4133}
a{color:#145b46;text-decoration:underline;overflow-wrap:anywhere}
code{font:9pt Consolas,monospace;background:#f1f5f2;padding:1px 3px}
table{width:100%;border-collapse:collapse;margin:5pt 0 9pt;font-size:8.4pt;line-height:1.23}
th,td{border:0.5pt solid #bbc9c0;padding:4pt 5pt;vertical-align:top;text-align:left}
th{background:#edf3ef;color:#173f31}
.footer{position:absolute;bottom:0;left:0;right:0;border-top:.5pt solid #d5ded8;padding-top:4pt;color:#66736c;font-size:8pt;display:flex;justify-content:space-between}
@media screen{body{background:#e8ede9}.page{width:210mm;min-height:297mm;margin:15px auto;padding:14mm 16mm 18mm;background:white;box-shadow:0 2px 12px #0002}.footer{left:16mm;right:16mm;bottom:12mm}}
</style></head><body>${pages.map((page, index) => `<section class="page">${renderPage(page).replace("<h1>", index ? '<h1 style="page-break-before:always">' : "<h1>")}<footer class="footer"><span>Bosque Claro · Informe técnico · 18-11-2026</span><span>${index + 1} / ${pages.length}</span></footer></section>`).join('')}</body></html>`;

fs.writeFileSync(htmlPath, html);
if (process.argv.includes('--html-only')) { console.log('HTML técnico preparado.'); process.exit(0); }
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally { await browser.close(); }
  process.stdout.write(`Informe generado: ${pages.length} secciones editables en Markdown y archivos HTML/PDF.\n`);
})().catch((error) => {
  process.stderr.write(`No se pudo generar el informe técnico: ${String(error.message || 'ERROR').slice(0, 160)}\n`);
  process.exitCode = 1;
});
