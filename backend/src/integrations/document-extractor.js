const TYPES = {
  doc: 'application/vnd.google-apps.document',
  sheet: 'application/vnd.google-apps.spreadsheet',
  pdf: 'application/pdf',
};

async function extractDocument(file, drive, dependencies = {}) {
  let text;
  if (file.mimeType === TYPES.doc) {
    text = (await drive.exportGoogleDoc(file.id)).toString('utf8');
  } else if (file.mimeType === TYPES.sheet) {
    const exceljs = dependencies.exceljs || await loadExcelJs();
    const workbook = new exceljs.Workbook();
    const bytes = await drive.exportGoogleSheet(file.id);
    await workbook.xlsx.load(bytes);
    const sections = [];
    for (const sheet of workbook.worksheets) {
      sections.push(`## Hoja: ${sheet.name}`);
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const values = row.values.slice(1).map(cellText).filter((v) => v !== '');
        if (values.length) sections.push(`Fila ${rowNumber}: ${values.join(' | ')}`);
      });
    }
    text = sections.join('\n');
  } else if (file.mimeType === TYPES.pdf) {
    const PDFParse = dependencies.PDFParse || (await import('pdf-parse')).PDFParse;
    const bytes = await drive.download(file.id);
    const parser = new PDFParse({ data: bytes });
    try { text = (await parser.getText()).text; }
    finally { await parser.destroy(); }
  } else {
    throw new Error(file.mimeType === 'application/vnd.google-apps.shortcut' ? 'DRIVE_SHORTCUT_UNSUPPORTED' : 'DRIVE_FILE_TYPE_UNSUPPORTED');
  }
  text = String(text || '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (!text) throw new Error('DOCUMENT_TEXT_EMPTY');
  return text;
}

async function loadExcelJs() { return require('exceljs'); }
function cellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value.text) return String(value.text);
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
    if (value.result !== undefined) return String(value.result);
    if (value.hyperlink) return `${value.text || ''} (${value.hyperlink})`;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value);
}

module.exports = { extractDocument, TYPES };
