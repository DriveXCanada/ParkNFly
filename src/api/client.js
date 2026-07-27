/**
 * Thin fetch wrapper for the same-origin backend API (/api).
 *
 * Sessions are httpOnly cookies set by the server, so there are no tokens to
 * manage here — the browser attaches the cookie automatically on same-origin
 * requests (credentials: 'include' makes that explicit). No secrets live here.
 */

const BASE = '/api'

export class ApiError extends Error {
  constructor(status, code) {
    super(code || `HTTP ${status}`)
    this.status = status
    this.code = code
  }
}

async function req(method, path, body) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    // Network / server unreachable — distinct from an HTTP error status.
    throw new ApiError(0, 'network_error')
  }
  if (!res.ok) {
    let code
    try {
      code = (await res.json())?.error
    } catch {
      /* no JSON body */
    }
    throw new ApiError(res.status, code)
  }
  return res.status === 204 ? null : res.json()
}

// Session / auth
export const getHealth = () => req('GET', '/health')
export const getMe = () => req('GET', '/me')
export const loginRequest = (email, password) => req('POST', '/login', { email, password })
export const kioskLoginRequest = (code, locationId) => req('POST', '/kiosk-login', { code, locationId })
export const logoutRequest = () => req('POST', '/logout')
export const changePasswordRequest = (currentPassword, newPassword) =>
  req('POST', '/change-password', { currentPassword, newPassword })
export const resetPasswordRequest = (accountId, newPassword) =>
  req('POST', `/accounts/${encodeURIComponent(accountId)}/reset-password`, { newPassword })

// Data
export const getBootstrap = () => req('GET', '/bootstrap')
export const createRecord = (collection, record) => req('POST', `/${collection}`, record)
export const updateRecord = (collection, id, patch) =>
  req('PATCH', `/${collection}/${encodeURIComponent(id)}`, patch)
export const deleteRecord = (collection, id) =>
  req('DELETE', `/${collection}/${encodeURIComponent(id)}`)
export const putConfig = (key, value) => req('PUT', `/config/${encodeURIComponent(key)}`, { value })
export const commitShiftRequest = (payload) => req('POST', '/commit-shift', payload)
export const resetSystemRequest = () => req('POST', '/reset-system')
