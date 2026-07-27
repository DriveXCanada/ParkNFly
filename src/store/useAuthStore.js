/**
 * useAuthStore — session state for the manager/owner area and the driver kiosk.
 *
 * Authentication is enforced server-side; the session is an httpOnly cookie the
 * browser sends automatically. This store mirrors that session for the UI:
 *   - currentUser / activeLocationId drive the manager dashboard.
 *   - sessionRole (owner|manager|kiosk|null) gates the driver kiosk.
 *   - initSession() restores state on load from GET /api/me.
 * When no backend is configured it falls back to the seeded local accounts so
 * the app still runs single-device.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useManagerStore } from './useManagerStore'
import { setSyncEnabled } from './sync'
import { getMe, getHealth, loginRequest, kioskLoginRequest, logoutRequest } from '../api/client'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUser: null, // { id, name, email, role, locationId } — managers/owners
      activeLocationId: null,
      sessionRole: null, // owner | manager | kiosk | null
      sessionReady: false, // has initSession finished?
      backendConfigured: false,

      // Build session state from an account profile returned by the server.
      _applySession: (account) => {
        const isManager = account.role === 'owner' || account.role === 'manager'
        set({
          sessionRole: account.role,
          currentUser: isManager
            ? { id: account.id, name: account.name, email: account.email, role: account.role, locationId: account.locationId }
            : null,
          activeLocationId: account.locationId ?? get().activeLocationId ?? null,
        })
      },

      // For owners with no location chosen yet, default to the first active one.
      _defaultOwnerLocation: () => {
        const { currentUser, activeLocationId } = get()
        if (currentUser?.role === 'owner' && !activeLocationId) {
          const locations = useManagerStore.getState().locations
          const loc = locations.find((l) => l.active)?.id || locations[0]?.id || null
          if (loc) set({ activeLocationId: loc })
        }
      },

      // Restore session on app load.
      initSession: async () => {
        try {
          const health = await getHealth()
          set({ backendConfigured: !!health?.configured })
        } catch { /* ignore */ }
        try {
          const { account } = await getMe()
          get()._applySession(account)
          await useManagerStore.getState().hydrate()
          get()._defaultOwnerLocation()
        } catch { /* no active session */ }
        set({ sessionReady: true })
      },

      // Manager/owner login.
      login: async (email, password) => {
        try {
          const { account } = await loginRequest(email, password)
          get()._applySession(account)
          await useManagerStore.getState().hydrate()
          get()._defaultOwnerLocation()
          return { ok: true, role: account.role }
        } catch (e) {
          if (e.status === 401) return { ok: false, error: 'Invalid email or password.' }
          if (e.status === 429) return { ok: false, error: 'Too many attempts — wait a few minutes and try again.' }
          if (e.status === 503 || e.status === 0) {
            const local = get()._localLogin(email, password)
            if (local) return local
            return { ok: false, error: e.status === 0 ? "Can't reach the server. Check your connection." : 'Invalid email or password.' }
          }
          return { ok: false, error: 'Something went wrong signing in. Please try again.' }
        }
      },

      // Driver tablet: unlock the kiosk with the location access code.
      loginKiosk: async (code, locationId) => {
        try {
          await kioskLoginRequest(code, locationId)
          set({ sessionRole: 'kiosk', activeLocationId: locationId ?? null })
          await useManagerStore.getState().hydrate()
          return { ok: true }
        } catch (e) {
          if (e.status === 401) return { ok: false, error: 'Incorrect access code.' }
          if (e.status === 429) return { ok: false, error: 'Too many attempts — wait a few minutes and try again.' }
          return { ok: false, error: "Can't reach the server. Check your connection." }
        }
      },

      // Fallback for no-backend / offline: validate against seeded local accounts.
      _localLogin: (email, password) => {
        const accounts = useManagerStore.getState().accounts
        const match = accounts.find(
          (a) => a.email?.toLowerCase() === String(email).trim().toLowerCase() && a.password === password,
        )
        if (!match) return null
        get()._applySession(match)
        get()._defaultOwnerLocation()
        return { ok: true, role: match.role }
      },

      logout: async () => {
        try {
          await logoutRequest()
        } catch { /* ignore */ }
        setSyncEnabled(false)
        set({ currentUser: null, sessionRole: null, activeLocationId: null })
        useManagerStore.setState({ synced: false })
      },

      setActiveLocation: (locationId) => {
        const user = get().currentUser
        if (user?.role === 'owner') set({ activeLocationId: locationId })
      },

      isOwner: () => get().currentUser?.role === 'owner',
    }),
    {
      name: 'shuttlelog-auth',
      // Only persist the display session; live flags are recomputed each load.
      partialize: (s) => ({ currentUser: s.currentUser, activeLocationId: s.activeLocationId }),
    },
  ),
)

export default useAuthStore
