import { request } from './http';

export function getVacaciones({ limit, offset, signal }) {
  return request(`/me/vacaciones?${new URLSearchParams({ limit, offset })}`, { signal });
}
