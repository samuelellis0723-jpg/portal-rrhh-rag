const configuredUrl = import.meta.env.VITE_API_URL || '/api/v1';
const baseUrl = configuredUrl.replace(/\/$/, '');
let csrfToken = null;
const listeners = new Set();

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function setCsrfToken(token) { csrfToken = token; }
export function onUnauthenticated(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const messages = {
  INVALID_CREDENTIALS: 'El correo o la contraseña no son correctos.',
  UNAUTHENTICATED: 'Tu sesión terminó. Inicia sesión de nuevo.',
  FORBIDDEN: 'No tienes permiso para consultar este recurso.',
  CSRF_INVALID: 'No pudimos validar la operación. Recarga la página e inténtalo de nuevo.',
  ORIGIN_NOT_ALLOWED: 'Este sitio no tiene acceso autorizado. Contacta a quien administra el portal.',
  VALIDATION_ERROR: 'Revisa los datos ingresados e inténtalo de nuevo.',
  RATE_LIMITED: 'Has realizado varios intentos. Espera unos minutos antes de volver a intentar.',
  DEPENDENCY_UNAVAILABLE: 'El servicio no está disponible en este momento. Inténtalo de nuevo más tarde.',
  REPORT_GENERATION_IN_PROGRESS: 'Ya hay una generación en curso para hoy. Inténtalo en unos segundos.',
};

export async function request(path, { method = 'GET', body, signal, authenticated = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD'].includes(method) && authenticated && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method, credentials: 'include', headers, signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectar con el portal. Revisa tu conexión e inténtalo de nuevo.');
  }
  let payload = null;
  if (response.status !== 204) {
    try { payload = await response.json(); } catch { /* Un proxy puede responder sin JSON. */ }
  }
  if (!response.ok) {
    const code = payload?.error?.code || 'SERVICE_ERROR';
    if (response.status === 401 && authenticated) listeners.forEach((listener) => listener());
    throw new ApiError(response.status, code, messages[code] || 'No pudimos completar la solicitud. Inténtalo de nuevo.');
  }
  if (response.status !== 204 && (!payload || !Object.hasOwn(payload, 'data'))) {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'El portal devolvió una respuesta inesperada. Inténtalo de nuevo.');
  }
  return payload?.data;
}
