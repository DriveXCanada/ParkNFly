/**
 * Thin fetch wrapper for the same-origin backend API (/api).
 *
 * In production the Express server serves both the app and /api. In dev, Vite
 * proxies /api to the local server (see vite.config.js). Every call is a plain
 * JSON request; there are no secrets here — the DB lives behind the server.
 */

const BASE = '/api'

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
  return res.status === 204 ? null : res.json()
}

export const getHealth = () => req('GET', '/health')
export const getBootstrap = () => req('GET', '/bootstrap')
export const loginRequest = (email, password) => req('POST', '/login', { email, password })
export const createRecord = (collection, record) => req('POST', `/${collection}`, record)
export const updateRecord = (collection, id, patch) =>
  req('PATCH', `/${collection}/${encodeURIComponent(id)}`, patch)
export const deleteRecord = (collection, id) =>
  req('DELETE', `/${collection}/${encodeURIComponent(id)}`)
export const putConfig = (key, value) => req('PUT', `/config/${encodeURIComponent(key)}`, { value })
