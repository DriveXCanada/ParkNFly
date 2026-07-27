/**
 * Write-through sync with a durable offline outbox.
 *
 * Every mutation updates local state optimistically and is mirrored to the
 * backend. If a write can't reach the server (offline / transient), it is
 * persisted to an outbox in localStorage and replayed automatically on
 * reconnect — so a shift ended in a dead-zone is never lost. Permanent
 * failures (validation/forbidden) are dropped with a warning rather than
 * retried forever.
 *
 * `pendingOverlay()` lets the store keep unacknowledged local records visible
 * even when a background refresh pulls a server snapshot that predates them.
 *
 * When sync is disabled (no backend / not signed in) every helper is a no-op.
 */

import {
  ApiError, createRecord, updateRecord, deleteRecord, putConfig, commitShiftRequest,
} from '../api/client'
import { useToastStore } from './useToastStore'

const OUTBOX_KEY = 'pnf-outbox'

let enabled = false
export const setSyncEnabled = (v) => { enabled = !!v }
export const isSyncEnabled = () => enabled

// ---- Outbox persistence ---------------------------------------------------
function loadOutbox() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]')
  } catch {
    return []
  }
}
function saveOutbox(items) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items))
  } catch {
    /* quota — best effort */
  }
}
let outbox = loadOutbox()
const persist = () => saveOutbox(outbox)
const uid = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`

export const hasPending = () => outbox.length > 0

let warnedOffline = false
function warnOffline() {
  if (warnedOffline) return
  warnedOffline = true
  try {
    useToastStore.getState().addToast('Offline — changes are saved on this device and will sync when you reconnect.', 'warning')
  } catch { /* ignore */ }
}
function warnDropped() {
  try {
    useToastStore.getState().addToast("A change couldn't be saved to the server and was skipped.", 'warning')
  } catch { /* ignore */ }
}

// Send one outbox item. Returns 'ok' | 'retry' (keep) | 'drop' (discard).
async function send(item) {
  try {
    if (item.kind === 'create') await createRecord(item.collection, item.payload)
    else if (item.kind === 'update') await updateRecord(item.collection, item.payload.id, item.payload.patch)
    else if (item.kind === 'delete') await deleteRecord(item.collection, item.payload.id)
    else if (item.kind === 'config') await putConfig(item.payload.key, item.payload.value)
    else if (item.kind === 'commit') await commitShiftRequest(item.payload)
    return 'ok'
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) return 'retry' // offline / unreachable
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return 'retry' // needs re-auth; keep
    if (e instanceof ApiError && e.status >= 500) return 'retry' // transient server error
    return 'drop' // 4xx validation etc. — won't succeed on retry
  }
}

let flushing = false
export async function flush() {
  if (!enabled || flushing || !outbox.length) return
  flushing = true
  try {
    while (outbox.length) {
      const item = outbox[0]
      const result = await send(item)
      if (result === 'retry') break // stop; try again later
      if (result === 'drop') warnDropped()
      outbox.shift()
      persist()
    }
    if (!outbox.length) warnedOffline = false
  } finally {
    flushing = false
  }
}

function enqueue(item) {
  outbox.push({ ...item, _id: uid() })
  persist()
  warnOffline()
}

// Try immediately; on failure, decide keep-vs-drop like flush().
async function attempt(item) {
  if (!enabled) return
  const result = await send(item)
  if (result === 'retry') enqueue(item)
  else if (result === 'drop') warnDropped()
}

// ---- Public write-through helpers -----------------------------------------
export function syncCreate(collection, record) {
  attempt({ kind: 'create', collection, payload: record })
}
export function syncUpdate(collection, id, patch) {
  attempt({ kind: 'update', collection, payload: { id, patch } })
}
export function syncDelete(collection, id) {
  attempt({ kind: 'delete', collection, payload: { id } })
}
export function syncConfig(key, value) {
  attempt({ kind: 'config', payload: { key, value } })
}
export function syncCommitShift(payload) {
  attempt({ kind: 'commit', payload })
}

/**
 * Records still waiting to reach the server, grouped by collection, so a
 * background refresh doesn't drop them. Includes queued creates and the
 * shift/inspection/incidents inside a queued commit.
 */
export function pendingOverlay() {
  const out = {}
  const add = (collection, rec) => {
    if (!rec || typeof rec.id !== 'string') return
    ;(out[collection] ||= []).push(rec)
  }
  for (const item of outbox) {
    if (item.kind === 'create') add(item.collection, item.payload)
    else if (item.kind === 'commit') {
      add('shifts', item.payload.shift)
      if (item.payload.inspection) add('inspections', item.payload.inspection)
      for (const inc of item.payload.incidents || []) add('incidents', inc)
    }
  }
  return out
}

// Replay whenever connectivity returns.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flush() })
}
