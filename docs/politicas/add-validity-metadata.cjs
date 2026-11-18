const fs = require('node:fs');
const path = require('node:path');
const dir = __dirname;
const validity = '2026-11-17 (solo simulación; sin adopción empresarial)';
for (const file of fs.readdirSync(dir).filter((name) => /^D\d\d-.*\.md$/.test(name))) {
  const full = path.join(dir, file);
  let text = fs.readFileSync(full, 'utf8');
  if (!text.includes('vigencia_propuesta:')) text = text.replace(/^(fecha:\s*[^\n]+\n)/m, `$1vigencia_propuesta: "${validity}"\n`);
  fs.writeFileSync(full, text);
}
for (const file of ['D02-feriados-2026.csv', 'D07-calendario-pagos-2026.csv']) {
  const full = path.join(dir, file);
  let text = fs.readFileSync(full, 'utf8');
  if (!text.includes('Vigencia propuesta,')) text = text.replace(/(Fecha,[^\n]+\n)/, `$1Vigencia propuesta,${validity}\n`);
  fs.writeFileSync(full, text);
}
const manifestPath = path.join(dir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const doc of manifest.documents) doc.vigencia_propuesta = validity;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
