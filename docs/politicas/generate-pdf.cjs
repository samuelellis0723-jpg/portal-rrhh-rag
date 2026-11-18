const { chromium } = require('../../frontend/node_modules/playwright');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const html = path.resolve(__dirname, 'pdf/D04-incapacidades.html');
    await page.goto(`file://${html}`, { waitUntil: 'load' });
    await page.pdf({ path: path.resolve(__dirname, 'pdf/D04-incapacidades.pdf'), format: 'A4', printBackground: true, margin: { top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' } });
  } finally { await browser.close(); }
})().catch((error) => { console.error('No se pudo generar D04 PDF:', error.message); process.exitCode = 1; });
