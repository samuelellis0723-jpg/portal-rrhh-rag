async function jsonRequest(url, { headers = {}, timeoutMs = 45000, ...options } = {}) {
  const response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json', ...headers } });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    const error = new Error(`HTTP_${response.status}`);
    error.status = response.status;
    error.payload = body;
    throw error;
  }
  return body;
}

module.exports = { jsonRequest };
