import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const { Sesion, SaldoVacaciones, ConsultaChat, AgentExecutionLog, sequelize } = require('../../backend/src/models');
const { authConfig } = require('../../backend/src/config/auth');
const config = authConfig();
const created = new Set();
const chatIds = new Set();

test.afterAll(async () => {
  if (chatIds.size) {
    await AgentExecutionLog.destroy({ where: { consulta_chat_id: [...chatIds] } });
    await ConsultaChat.destroy({ where: { id: [...chatIds] } });
  }
  if (created.size) await Sesion.destroy({ where: { token_hash: [...created] } });
  await sequelize.close();
});

async function enter(page, context, role) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(`${role}@bosqueclaro.example`);
  const secret = process.env[role === 'rrhh' ? 'DEMO_RRHH_PASSWORD' : 'DEMO_COLABORADOR_PASSWORD'];
  if (!secret) throw new Error('Falta configurar la contraseña demo en backend/.env.');
  await page.getByLabel('Contraseña', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await expect(page).toHaveURL('/mi-espacio');
  const cookie = (await context.cookies()).find((entry) => entry.name === config.cookieName);
  expect(Boolean(cookie?.httpOnly)).toBe(true);
  const hash = createHash('sha256').update(cookie.value).digest('hex');
  created.add(hash);
  return hash;
}

test('ambas cuentas: login, recarga, saldo SQL, paginación y logout real', async ({ page, context }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.name));
  for (const role of ['colaborador', 'rrhh']) {
    const hash = await enter(page, context, role);
    const session = await Sesion.findOne({ where: { token_hash: hash } });
    const user = await session.getUsuario();
    const person = await user.getColaborador();
    await expect(page.getByText(person.nombre, { exact: true })).toBeVisible();
    await expect(page.getByText(role === 'rrhh' ? 'Recursos Humanos' : 'Colaborador', { exact: true })).toBeVisible();
    const own = await SaldoVacaciones.findAll({ where: { colaborador_id: person.id }, raw: true });
    const cents = own.reduce((total, row) => total + BigInt(row.dias_disponibles.replace('.', '')), 0n);
    const expected = `${cents / 100n},${String(cents % 100n).padStart(2, '0')}`;
    await expect(page.getByTestId('total-balance')).toHaveText(expected);
    await expect(page.getByRole('table')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL('/mi-espacio');
    await expect(page.getByTestId('total-balance')).toHaveText(expected);
    const responsePromise = page.waitForResponse((response) => response.url().includes('/me/vacaciones?limit=10&offset=0'));
    await page.getByLabel('Períodos por página').selectOption('10');
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.data.total).toBe(own.length);
    expect(payload.data.limit).toBe(10);
    expect(payload.data.items.map((item) => item.id).sort()).toEqual(own.map((item) => item.id).sort());
    await expect(page.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0)).toBe(true);
    if (role === 'colaborador') {
      await page.screenshot({ path: testInfo.outputPath('mi-espacio.png'), fullPage: true });
      await page.route('**/api/v1/me/vacaciones?**', (route) => route.abort('failed'));
      await page.getByLabel('Períodos por página').selectOption('5');
      await expect(page.getByRole('alert')).toContainText('No pudimos conectar');
      await expect(page.getByText('No disponible', { exact: true })).toBeVisible();
      await page.unroute('**/api/v1/me/vacaciones?**');
      await page.getByRole('button', { name: 'Volver a intentar' }).click();
      await expect(page.getByTestId('total-balance')).toHaveText(expected);
      await page.route('**/api/v1/auth/logout', (route) => route.abort('failed'));
      await page.getByRole('button', { name: 'Cerrar sesión' }).click();
      await expect(page.getByRole('alert')).toContainText('No pudimos conectar');
      await expect(page).toHaveURL('/mi-espacio');
      expect((await session.reload()).revocada_en === null).toBe(true);
      await page.unroute('**/api/v1/auth/logout');

      await test.step('Chat real con sesión, CSRF, MySQL e historial persistente', async () => {
        await page.getByRole('link', { name: 'Asistente de RRHH' }).click();
        await expect(page).toHaveURL('/chat');
        const question = `Prueba de navegador ${randomUUID()}. ¿Cuántos días de vacaciones me quedan disponibles?`;
        await page.getByLabel('Escribe tu consulta').fill(question);
        const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/chat') && response.request().method() === 'POST');
        await page.getByRole('button', { name: 'Enviar consulta' }).click();
        const response = await responsePromise;
        expect(response.status()).toBe(200);
        const payload = await response.json();
        chatIds.add(payload.data.consulta_id);
        expect(payload.data.dato_personal.dias_disponibles.replace('.', ',')).toBe(expected);
        const turn = page.locator('.chat-turn').filter({ hasText: question });
        await expect(turn.locator('.personal-result strong')).toHaveText(`${expected} días`);
        await page.reload();
        await expect(page.locator('.chat-turn').filter({ hasText: question }).locator('.personal-result strong')).toHaveText(`${expected} días`);
        await page.screenshot({ path: testInfo.outputPath('chat-sql-real.png'), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });

      await test.step('Contrato visual de citas y respuesta mixta con un doble explícito de red', async () => {
        // Este bloque prueba renderizado, no una cita ni una llamada LLM reales.
        await page.route('**/api/v1/chat', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
          consulta_id: 1999999990, intencion: 'mixta', estado: 'respondida', respuesta: 'Respuesta de prueba de interfaz con dos fuentes.',
          dato_personal: { dias_disponibles: '8.00', fecha_corte: '2026-11-18' }, escalada: false,
          citas: [{ documento: 'Documento de prueba (doble de UI)', seccion: 'Solicitud', version: 'test', drive_file_id: 'ui-fixture-not-real', fragmento_id: 'test-fragment', enlace: 'https://drive.google.com/file/d/ui-fixture-not-real/view' }],
        } }) }));
        await page.getByLabel('Escribe tu consulta').fill('Consulta de renderizado de prueba.');
        await page.getByRole('button', { name: 'Enviar consulta' }).click();
        const citation = page.getByRole('link', { name: 'Documento de prueba (doble de UI)' });
        await expect(citation).toHaveAttribute('target', '_blank');
        await expect(citation).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(page.getByText('Solicitud · Versión test')).toBeVisible();
        await page.unroute('**/api/v1/chat');
        await page.goto('/rrhh/reportes');
        await expect(page).toHaveURL('/mi-espacio');
        expect((await page.request.get('/api/v1/rrhh/reportes')).status()).toBe(403);
      });
    } else {
      await test.step('Dashboard RRHH con reporte real persistido identificado como fixture', async () => {
        await page.getByRole('link', { name: 'Reportes', exact: true }).click();
        await expect(page).toHaveURL('/rrhh/reportes');
        await page.getByLabel('Fecha del reporte').selectOption('2026-11-17');
        await expect(page.getByText('Datos simulados · Fixture')).toBeVisible();
        await expect(page.locator('.report-metric')).toHaveCount(4);
        await expect(page.locator('.report-chart')).toHaveCount(2);
        await expect(page.getByRole('heading', { name: 'Solicitudes que necesitan seguimiento' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Temas más consultados' })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('reportes-fixture.png'), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL('/login');
    expect(Boolean((await session.reload()).revocada_en)).toBe(true);
    const state = await page.request.get('/api/v1/auth/session');
    expect(state.status()).toBe(401);
    await page.goto('/mi-espacio');
    await expect(page).toHaveURL('/login');
  }
  expect(errors).toEqual([]);
});

test('una sesión vencida en MySQL vuelve al login ante un 401 y al recargar', async ({ page, context }) => {
  const hash = await enter(page, context, 'colaborador');
  await expect(page.getByTestId('total-balance')).toBeVisible();
  await Sesion.update({ creada_en: new Date(Date.now() - 10 * 3600000), expira_en: new Date(Date.now() - 1000) }, { where: { token_hash: hash } });
  await page.getByLabel('Períodos por página').selectOption('10');
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('status')).toContainText('Tu sesión terminó');
  await page.reload();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Hola,', exact: false })).toHaveCount(0);
});

test('protección privada, formulario accesible y error de credenciales', async ({ page }) => {
  await page.goto('/mi-espacio');
  await expect(page).toHaveURL('/login');
  await page.getByLabel('Correo electrónico').fill('colaborador@bosqueclaro.example');
  await page.getByLabel('Contraseña', { exact: true }).fill('ContraseñaIncorrectaSoloPrueba');
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await expect(page.getByRole('alert')).toContainText('El correo o la contraseña no son correctos.');
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('');
  await expect(page).toHaveURL('/login');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('una caída al recuperar sesión muestra error y permite reintentar', async ({ page }) => {
  await page.route('**/api/v1/auth/session', (route) => route.abort('failed'));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('No pudimos conectar');
  await expect(page.getByLabel('Correo electrónico')).toHaveCount(0);
  await page.unroute('**/api/v1/auth/session');
  await page.getByRole('button', { name: 'Volver a intentar' }).click();
  await expect(page).toHaveURL('/login');
});
