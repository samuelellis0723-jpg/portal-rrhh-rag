// Recorrido explícito con proveedores reales. El borrado final elimina el historial de la cuenta demo colaborador.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const models = require('../../backend/src/models');
const reportRepository = require('../../backend/src/repositories/report-repository');
const evidence = { fecha: new Date().toISOString(), modo: 'Chromium + HTTP/MySQL y proveedores reales', consultas: [], citas_abiertas: [], checks: [] };
let browser;
async function login(page, role) {
  await page.goto('http://localhost:5173/login');
  await page.getByLabel('Correo electrónico').fill(`${role}@bosqueclaro.example`);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env[role === 'rrhh' ? 'DEMO_RRHH_PASSWORD' : 'DEMO_COLABORADOR_PASSWORD']);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await page.waitForURL('**/mi-espacio');
}
async function ask(page, pregunta) {
  await page.getByLabel('Escribe tu consulta').fill(pregunta);
  const pending = page.waitForResponse((r) => r.url().endsWith('/api/v1/chat') && r.request().method() === 'POST', { timeout: 65000 });
  await page.getByRole('button', { name: 'Enviar consulta' }).click();
  const response = await pending, payload = await response.json();
  assert.equal(response.status(), 200);
  await expect(page.locator('.chat-turn').last().locator('.answer-text')).toHaveText(payload.data.respuesta);
  evidence.consultas.push({ pregunta, http: response.status(), data: payload.data });
  return payload.data;
}
async function openCitations(page, result) {
  const turn = page.locator('.chat-turn').last();
  for (const citation of result.citas) {
    const link = turn.getByRole('link').filter({ hasText: citation.documento }).first();
    await expect(link).toHaveAttribute('href', citation.enlace);
    const popupPromise = page.waitForEvent('popup');
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    const text = (await popup.locator('body').innerText().catch(() => '')).slice(0, 2500);
    evidence.citas_abiertas.push({ documento: citation.documento, seccion: citation.seccion, enlace: citation.enlace,
      url_abierta: `${new URL(popup.url()).origin}${new URL(popup.url()).pathname}`, requiere_login_o_permiso: /accounts\.google\.com|ServiceLogin/.test(popup.url()) || /sign in|inicia sesi[oó]n|request access|solicitar acceso|you need access|necesitas acceso/i.test(text),
      titulo_pagina: await popup.title() });
    await popup.close();
  }
}
async function main() {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.name));
  await login(page, 'colaborador'); await page.goto('http://localhost:5173/chat');
  for (const q of ['hola', 'buenas', 'buenos días']) assert.equal((await ask(page, q)).intencion, 'saludo');
  for (const q of ['cuando es feriado', 'cuando es el proximo feriado?']) {
    const result = await ask(page, q); assert.equal(result.estado, 'respondida'); assert.ok(result.citas.length);
    await openCitations(page, result);
  }
  const session = (await (await page.request.get('/api/v1/auth/session')).json()).data;
  const expected = await require('../../backend/src/repositories/personal-chat-repository').ownVacationBalance(session.colaborador.id, '2026-11-19');
  for (const q of ['cuantas vacaciones tengo', 'Hola, ¿cuántas vacaciones tengo?']) {
    const result = await ask(page, q); assert.equal(result.dato_personal.dias_disponibles, expected.dias_disponibles);
  }
  const mixed = await ask(page, '¿Cuántos días me quedan y puedo pasarlos al año siguiente?');
  assert.equal(mixed.intencion, 'mixta'); assert.equal(mixed.partes.datos, 'respondida'); assert.equal(mixed.partes.politicas, 'respondida');
  assert.ok(mixed.citas.length); assert.equal(mixed.dato_personal.dias_disponibles, expected.dias_disponibles); await openCitations(page, mixed);
  evidence.checks.push('Saludos, ambas frases de feriados, saldo MySQL y pregunta mixta con fuentes reales');
  await page.screenshot({ path: '/tmp/bosque-chat-final.png', fullPage: true });
  // Cancelar no emite DELETE y conserva el historial tras recargar.
  const beforeHistory = (await (await page.request.get('/api/v1/chat/historial')).json()).data;
  let deletes = 0;
  page.on('request', (request) => { if (request.method() === 'DELETE') deletes++; });
  await page.getByRole('button', { name: 'Eliminar conversación', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.reload(); await expect(page.getByLabel('Escribe tu consulta')).toBeEnabled();
  assert.equal(deletes, 0);
  assert.equal((await (await page.request.get('/api/v1/chat/historial')).json()).data.total, beforeHistory.total);
  evidence.checks.push('Cancelar conserva el historial también después de recargar');
  const rrhh = await models.Colaborador.findOne({ where: { correo: 'rrhh@bosqueclaro.example' } });
  const otherBefore = await models.ConsultaChat.count({ where: { colaborador_id: rrhh.id, origen: 'ejecucion' } });
  const metricsBefore = await reportRepository.aggregateReport('2026-11-20');
  await page.getByRole('button', { name: 'Eliminar conversación', exact: true }).click();
  const deleting = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().includes('/chat/historial'));
  await page.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click();
  const deleted = await deleting; assert.equal(deleted.status(), 200);
  await expect(page.getByRole('heading', { name: '¿En qué te ayudamos hoy?' })).toBeVisible();
  await expect(page.locator('.chat-turn')).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('heading', { name: '¿En qué te ayudamos hoy?' })).toBeVisible();
  assert.equal((await (await page.request.get('/api/v1/chat/historial')).json()).data.total, 0);
  assert.deepEqual(await require('../../backend/src/repositories/personal-chat-repository').recentConversationMemory(session.colaborador.id, 2147483647), []);
  assert.equal(await models.ConsultaChat.count({ where: { colaborador_id: rrhh.id, origen: 'ejecucion' } }), otherBefore);
  const metricsAfter = await reportRepository.aggregateReport('2026-11-20');
  assert.deepEqual(metricsAfter.uso_chatbot, metricsBefore.uso_chatbot); assert.deepEqual(metricsAfter.temas_chatbot, metricsBefore.temas_chatbot);
  evidence.checks.push('Confirmar borra contenido y memoria; recarga vacía; otra cuenta intacta; métricas conservadas');
  await page.screenshot({ path: '/tmp/bosque-chat-vacio.png', fullPage: true });
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login(page, 'rrhh'); await page.getByRole('link', { name: 'Reportes', exact: true }).click();
  await page.getByLabel('Fecha del reporte').selectOption('2026-11-19');
  await expect(page.locator('.report-metric')).toHaveCount(4); await expect(page.locator('.report-chart')).toHaveCount(2);
  const actualReport = (await (await page.request.get('/api/v1/rrhh/reportes/2026-11-19')).json()).data;
  assert.equal(actualReport.origen, 'ejecucion');
  evidence.reporte = { fecha: actualReport.fecha, origen: actualReport.origen, generado_en: actualReport.generado_en };
  evidence.checks.push('Dashboard RRHH abre reporte real del 19-11-2026 después de borrar conversación');
  await page.screenshot({ path: '/tmp/bosque-reporte-real.png', fullPage: true });
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  assert.deepEqual(errors, []);
  evidence.aprobado = true;
}
main().catch((error) => { evidence.aprobado = false; evidence.error = error.name; evidence.error_location = error.stack?.split('\n').find((line) => line.includes('verify-chat-live.cjs'))?.trim(); console.error('Verificación de navegador incompleta. Revisar evidencia sin secretos.'); process.exitCode = 1; })
  .finally(async () => { await fs.writeFile(path.resolve(__dirname, '../../docs/evaluacion/verificacion-navegador.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify({ aprobado: evidence.aprobado, checks: evidence.checks, citas_abiertas: evidence.citas_abiertas }));
    if (browser) await browser.close(); await models.sequelize.close(); });
