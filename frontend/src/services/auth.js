import { request } from './http';

export function login(email, password) {
  return request('/auth/login', { method: 'POST', body: { email, password }, authenticated: false });
}
export function getSession(signal) { return request('/auth/session', { signal }); }
export function logout() { return request('/auth/logout', { method: 'POST' }); }
