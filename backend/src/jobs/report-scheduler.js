const TIME_ZONE = 'America/Costa_Rica';

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function businessDate(date = new Date()) {
  const { year, month, day } = localParts(date);
  return `${year}-${month}-${day}`;
}

function due(date, hour, minute, now = new Date()) {
  const parts = localParts(now);
  return businessDate(now) === date && (Number(parts.hour) > hour
    || (Number(parts.hour) === hour && Number(parts.minute) >= minute));
}

function createDailyWorker({ reportTask, ingestionTask, now = () => new Date(), pollMs = 30000,
  onError = (task, error) => console.error(`${task} falló: ${safeErrorCode(error)}`), setTimer = setInterval, clearTimer = clearInterval } = {}) {
  if (typeof reportTask !== 'function' || typeof ingestionTask !== 'function') throw new Error('WORKER_TASKS_REQUIRED');
  let timer;
  let stopped = true;
  let reportDay = null, ingestionDay = null;
  let reportRetryAt = 0, ingestionRetryAt = 0;
  let runningReport = false, runningIngestion = false;
  const inFlightTicks = new Set();

  async function runReport(date) {
    if (runningReport || reportDay === date || now().getTime() < reportRetryAt || !due(date, 7, 0, now())) return;
    runningReport = true;
    try {
      const result = await reportTask(date);
      if (result?.status === 'busy') { reportRetryAt = now().getTime() + 60000; return; }
      reportDay = date;
    } catch (error) {
      reportRetryAt = now().getTime() + 5 * 60 * 1000;
      onError('reportes', error);
    } finally { runningReport = false; }
  }

  async function runIngestion(date) {
    if (runningIngestion || ingestionDay === date || now().getTime() < ingestionRetryAt || !due(date, 2, 0, now())) return;
    runningIngestion = true;
    try {
      await ingestionTask();
      ingestionDay = date;
    } catch (error) {
      ingestionRetryAt = now().getTime() + 15 * 60 * 1000;
      onError('ingesta', error);
    } finally { runningIngestion = false; }
  }

  async function tick() {
    const date = businessDate(now());
    // These tasks are isolated: one failure never prevents the other from running.
    const current = Promise.all([runReport(date), runIngestion(date)]);
    inFlightTicks.add(current);
    try { await current; } finally { inFlightTicks.delete(current); }
  }

  return {
    async start() {
      if (!stopped) return;
      stopped = false;
      await tick(); // recover missed schedule after a worker restart
      timer = setTimer(() => { if (!stopped) void tick(); }, pollMs);
    },
    async stop() {
      stopped = true;
      if (timer) clearTimer(timer);
      timer = undefined;
      await Promise.allSettled([...inFlightTicks]);
    },
    tick,
  };
}

function safeErrorCode(error) {
  return String(error?.code || error?.message || 'WORKER_ERROR').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 80);
}

module.exports = { TIME_ZONE, localParts, businessDate, due, createDailyWorker, safeErrorCode };
