/**
 * Write-through sync helpers.
 *
 * The manager store updates local state optimistically (instant UX) and then
 * calls these to persist the change to the backend. They are fire-and-forget:
 * on failure the local change stands and the user gets a soft warning, so a
 * dropped network request never breaks the app — it just won't have synced.
 *
 * When sync is disabled (no backend / no DATABASE_URL), every helper is a
 * no-op, so the app behaves exactly like the original local-only version.
 */

import { createRecord, updateRecord, deleteRecord, putConfig } from '../api/client'
import { useToastStore } from './useToastStore'

let enabled = false
export const setSyncEnabled = (v) => {
  enabled = !!v
}
export const isSyncEnabled = () => enabled

let warnedOnce = false
function warn() {
  // Only nag once per session so a flaky connection isn't a toast storm.
  if (warnedOnce) return
  warnedOnce = true
  try {
    useToastStore.getState().addToast('Saved on this device, but syncing to the server failed.', 'warning')
  } catch {
    /* toast store unavailable — ignore */
  }
}

export function syncCreate(collection, record) {
  if (!enabled) return
  createRecord(collection, record).catch(warn)
}

export function syncUpdate(collection, id, patch) {
  if (!enabled) return
  updateRecord(collection, id, patch).catch(warn)
}

export function syncDelete(collection, id) {
  if (!enabled) return
  deleteRecord(collection, id).catch(warn)
}

export function syncConfig(key, value) {
  if (!enabled) return
  putConfig(key, value).catch(warn)
}
