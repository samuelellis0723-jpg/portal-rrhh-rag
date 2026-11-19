const HEADING = /^\s{0,3}(#{1,6}\s+.+|\d+(?:\.\d+)*[.)]\s+[^\n]{3,100}|(?:\d+(?:\.\d+)*[.)]?\s+)?[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ0-9 ,;:()/_-]{3,100})\s*$/u;

function splitDocument(text, { maxChars = 3200, overlap = 400 } = {}) {
  if (!Number.isInteger(maxChars) || maxChars < 500 || !Number.isInteger(overlap) || overlap < 0 || overlap >= maxChars) {
    throw new Error('INGEST_CHUNK_CONFIG_INVALID');
  }
  const lines = text.replace(/\r/g, '').split('\n');
  const sections = [];
  let title = 'Introducción';
  let body = [];
  for (const line of lines) {
    if (HEADING.test(line.trim())) {
      if (body.join('\n').trim()) sections.push({ section: title, text: body.join('\n').trim() });
      title = line.trim().replace(/^#{1,6}\s*/, '');
      body = [];
    } else body.push(line);
  }
  if (body.join('\n').trim()) sections.push({ section: title, text: body.join('\n').trim() });
  if (!sections.length && text.trim()) sections.push({ section: 'Contenido', text: text.trim() });
  const chunks = [];
  for (const section of sections) {
    let remaining = section.text;
    let index = 0;
    while (remaining.length) {
      let end = Math.min(maxChars, remaining.length);
      if (end < remaining.length) {
        const boundary = Math.max(remaining.lastIndexOf('\n', end), remaining.lastIndexOf('. ', end), remaining.lastIndexOf(' ', end));
        if (boundary > Math.floor(maxChars * 0.6)) end = boundary + 1;
      }
      const content = remaining.slice(0, end).trim();
      if (content) chunks.push({ section: section.section, text: content, section_chunk_index: index++ });
      if (end >= remaining.length) break;
      remaining = remaining.slice(Math.max(1, end - overlap)).trimStart();
    }
  }
  return chunks;
}

module.exports = { splitDocument };
