/**
 * useAuthStore — simulated manager/owner authentication + active location.
 *
 * ⚠️ SIMULATED AUTH ONLY (prototype). Credentials are validated against the
 * accounts held in useManagerStore (plain text in the browser). This is NOT
 * secure and must be replaced with real authentication before launch.
 *
 * AIRTABLE: Replace login() with a real auth provider (e.g. Airtable + Auth0 /
 * Clerk / Supabase Auth). currentUser would come from the verified session.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useManagerStore } from './useManagerStore'
import { isSyncEnabled } from './sync'
import { loginRequest } from '../api/client'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUser: null, // { id, name, email, role, locationId }
      activeLocationId: null, // location currently being viewed

      // When synced, credentials are verified server-side (passwords never
      // reach the browser). Local-only mode falls back to the seeded accounts.
      login: async (email, password) => {
        const locations = useManagerStore.getState().locations
        const asSession = (acct) => {
          const defaultLoc =
            acct.role === 'owner'
              ? locations.find((l) => l.active)?.id || locations[0]?.id || null
              : acct.locationId
          set({
            currentUser: {
              id: acct.id,
              name: acct.name,
              email: acct.email,
              role: acct.role,
              locationId: acct.locationId,
            },
            activeLocationId: defaultLoc,
          })
          return { ok: true, role: acct.role }
        }

        if (isSyncEnabled()) {
          try {
            const { account } = await loginRequest(email, password)
            return asSession(account)
          } catch {
            return { ok: false, error: 'Invalid email or password.' }
          }
        }

        const accounts = useManagerStore.getState().accounts
        const match = accounts.find(
          (a) => a.email.toLowerCase() === String(email).trim().toLowerCase() && a.password === password,
        )
        if (!match) return { ok: false, error: 'Invalid email or password.' }
        return asSession(match)
      },

      logout: () => set({ currentUser: null, activeLocationId: null }),

      setActiveLocation: (locationId) => {
        const user = get().currentUser
        // Only the owner may switch locations; managers are locked to theirs.
        if (user?.role === 'owner') set({ activeLocationId: locationId })
      },

      isOwner: () => get().currentUser?.role === 'owner',
    }),
    { name: 'shuttlelog-auth' },
  ),
)

export default useAuthStore
