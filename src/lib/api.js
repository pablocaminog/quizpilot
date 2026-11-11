import { ROUTES } from '@/shared/protocol.js';

// Fills :param segments of a protocol route template and splits "METHOD /path".
export function route(key, params = {}) {
  const [method, template] = ROUTES[key].split(' ');
  const path = template.replace(/:([A-Za-z]+)/g, (_, name) => encodeURIComponent(params[name] ?? ''));
  return { method, path };
}

export async function api(key, params = {}, { body, headers, raw } = {}) {
  const { method, path } = route(key, params);
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined && !raw ? { 'content-type': 'application/json' } : {}),
        ...(headers ?? {}),
      },
      body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw { status: 0, error: 'NETWORK', message: 'Connection lost. Reconnecting…' };
  }
  let json = null;
  try {
    json = await response.json();
  } catch {}
  if (!response.ok) {
    throw { status: response.status, error: json?.error ?? 'UNKNOWN', message: json?.message, field: json?.field };
  }
  return json;
}
