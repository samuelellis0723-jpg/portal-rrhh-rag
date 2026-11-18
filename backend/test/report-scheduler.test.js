const test = require('node:test');
const assert = require('node:assert/strict');
const { businessDate, due, createDailyWorker } = require('../src/jobs/report-scheduler');

test('calcula la hora local de Costa Rica independiente de la zona del proceso', () => {
  assert.equal(businessDate(new Date('2026-11-18T13:00:00.000Z')), '2026-11-18');
  assert.equal(due('2026-11-18', 7, 0, new Date('2026-11-18T13:00:00.000Z')), true);
  assert.equal(due('2026-11-18', 7, 0, new Date('2026-11-18T12:59:00.000Z')), false);
  assert.equal(due('2026-11-18', 7, 0, new Date('2026-11-18T06:59:00.000Z')), false);
});

test('reporte e ingesta independientes: un fallo del resumen no impide sincronizar Drive', async () => {
  let now = new Date('2026-11-18T13:02:00.000Z');
  const calls = [];
  const worker = createDailyWorker({ now: () => now, pollMs: 100000,
    reportTask: async (date) => { calls.push(['report', date]); throw new Error('deepseek offline'); },
    ingestionTask: async () => { calls.push(['ingestion']); }, onError() {}, setTimer: () => 1, clearTimer() {},
  });
  await worker.start();
  assert.deepEqual(calls, [['report', '2026-11-18'], ['ingestion']]);
  await worker.tick();
  assert.equal(calls.filter(([task]) => task === 'report').length, 1, 'el fallo respeta backoff');
  assert.equal(calls.filter(([task]) => task === 'ingestion').length, 1, 'la ingesta diaria no se duplica');
  now = new Date('2026-11-18T13:08:00.000Z');
  await worker.tick();
  assert.equal(calls.filter(([task]) => task === 'report').length, 2, 'reintenta luego del backoff');
  await worker.stop();
});

test('worker wait on shutdown for in-flight scheduled work', async () => {
  let release;
  const started = new Promise((resolve) => { release = resolve; });
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const worker = createDailyWorker({ now: () => new Date('2026-11-18T13:00:00.000Z'),
    reportTask: async () => { release(); await pending; return { status: 'created' }; },
    ingestionTask: async () => {}, setTimer: () => 1, clearTimer() {}, onError() {},
  });
  const starting = worker.start();
  await started;
  let stopped = false;
  const stopping = worker.stop().then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(stopped, false);
  finish();
  await Promise.all([starting, stopping]);
  assert.equal(stopped, true);
});
