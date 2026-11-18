import { request } from './http';

export function getChatHistory({ limit = 20, offset = 0, signal } = {}) {
  return request(`/chat/historial?${new URLSearchParams({ limit, offset })}`, { signal });
}
export function sendMessage(mensaje) { return request('/chat', { method: 'POST', body: { mensaje } }); }
