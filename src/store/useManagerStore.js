/**
 * useManagerStore — system of record for the manager/owner side.
 *
 * Holds locations, accounts (owner + managers), staff (drivers), vehicles,
 * shifts, trips, inspections, incidents, and configuration. Seeded from the
 * mock data files, then PERSISTED to localStorage so everything you add
 * (locations, managers, staff, vehicles, incidents, notes) survives reloads.
 *
 * BACKEND: each collection maps to a Postgres table; every mutation below
 * becomes a POST/PATCH. Swap the seed imports + persist layer for fetch hooks.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { mockDrivers, initialsFromName } from '../data/mockDrivers'
import { mockVehicles } from '../data/mockVehicles'
import { mockShifts, flattenTrips, REFERENCE_TODAY } from '../data/mockShifts'
import { mockInspections } from '../data/mockInspections'
import { mockLocations } from '../data/mockLocations'
import { mockAccounts } from '../data/mockAccounts'
import { mockIncidents } from '../data/mockIncidents'
import { inspectionGroups, defaultCriticalItems } from '../data/inspectionItems'
import { todayKey } from '../utils/formatters'
import { DEMO, BOOTSTRAP_OWNER } from '../config'
import { getBootstrap, resetSystemRequest } from '../api/client'
import { useToastStore } from './useToastStore'
import {
  setSyncEnabled, isSyncEnabled, syncCreate, syncUpdate, syncDelete, syncConfig,
  syncCommitShift, flush, pendingOverlay,
} from './sync'

// Collections that mirror to the backend (state keys === API collection names).
const SYNC_COLLECTIONS = ['locations', 'accounts', 'drivers', 'vehicles', 'shifts', 'inspections', 'incidents']

const initialChecklist = inspectionGroups.flatMap((g) =>
  g.items.map((i) => ({ key: i.key, label: i.label, category: g.label, active: true })),
)

const baseConfig = () => ({
  settings: {
    notifications: {
      failedInspectionAlerts: true,
      dailySummaryEmail: true,
      shiftReminderTexts: false,
      maintenanceDueAlerts: true,
      incidentAlerts: true,
    },
  },
  checklist: initialChecklist,
  criticalItems: [...defaultCriticalItems],
  reportTimestamps: { daily: null, inspection: null, operations: null, incident: null },
})

// DEMO seed — full sample dataset for the client showcase.
const demoSeed = () => ({
  locations: mockLocations.map((l) => ({ ...l })),
  accounts: mockAccounts.map((a) => ({ ...a })),
  drivers: mockDrivers.map((d) => ({ ...d })),
  vehicles: mockVehicles.map((v) => ({ ...v })),
  shifts: mockShifts.map((s) => ({ ...s })),
  trips: flattenTrips(mockShifts),
  inspections: mockInspections.map((i) => ({ ...i })),
  incidents: mockIncidents.map((i) => ({ ...i })),
  referenceToday: REFERENCE_TODAY,
  ...baseConfig(),
})

// BLANK seed — clean, production-ready system: no sample data, one bootstrap
// owner account, the functional inspection checklist, and today's real date.
const blankSeed = () => ({
  locations: [],
  accounts: [{ ...BOOTSTRAP_OWNER }],
  drivers: [],
  vehicles: [],
  shifts: [],
  trips: [],
  inspections: [],
  incidents: [],
  referenceToday: todayKey(),
  ...baseConfig(),
})

// Fresh seed snapshot (used on first load and on "reset system").
const seed = () => (DEMO ? demoSeed() : blankSeed())

let seq = Date.now()
const newId = (prefix) => `${prefix}-${(seq++).toString(36).toUpperCase()}`

export const useManagerStore = create(
  persist(
    (set, get) => ({
      ...seed(),

      // Whether this session is connected to the shared cloud database.
      synced: false,

      // ---- Backend sync (Railway Postgres) ---------------------------------
      // Adopt a server snapshot, but overlay any records still queued locally
      // (offline writes) so a refresh never drops a shift the server hasn't
      // received yet.
      _applyServer: (data) => {
        const cfg = data.config || {}
        const overlay = pendingOverlay()
        const merge = (collection, serverList) => {
          const list = [...(serverList || [])]
          const seen = new Set(list.map((r) => r.id))
          for (const rec of overlay[collection] || []) {
            if (!seen.has(rec.id)) list.push(rec)
          }
          return list
        }
        const shifts = merge('shifts', data.shifts)
        set({
          locations: merge('locations', data.locations),
          accounts: data.accounts || [],
          drivers: merge('drivers', data.drivers),
          vehicles: merge('vehicles', data.vehicles),
          shifts,
          inspections: merge('inspections', data.inspections),
          incidents: merge('incidents', data.incidents),
          trips: flattenTrips(shifts),
          ...(cfg.settings ? { settings: cfg.settings } : {}),
          ...(cfg.checklist ? { checklist: cfg.checklist } : {}),
          ...(cfg.criticalItems ? { criticalItems: cfg.criticalItems } : {}),
          ...(cfg.reportTimestamps ? { reportTimestamps: cfg.reportTimestamps } : {}),
          referenceToday: DEMO ? data.referenceToday || get().referenceToday : todayKey(),
        })
      },

      // First load: detect the backend, adopt server data, ensure config
      // defaults exist server-side, and replay any queued offline writes. Safe
      // to call with no backend — it just disables sync (local-only mode).
      hydrate: async () => {
        let data
        try {
          data = await getBootstrap()
        } catch {
          setSyncEnabled(false)
          set({ synced: false })
          return false
        }
        if (!data || !data.configured) {
          setSyncEnabled(false)
          set({ synced: false })
          return false
        }
        setSyncEnabled(true)
        set({ synced: true })
        get()._applyServer(data)

        // Seed any config rows the server doesn't have yet (defaults live in the
        // frontend; the owner account is seeded server-side).
        const s = get()
        const cfg = data.config || {}
        if (!cfg.settings) syncConfig('settings', s.settings)
        if (!cfg.checklist) syncConfig('checklist', s.checklist)
        if (!cfg.criticalItems) syncConfig('criticalItems', s.criticalItems)
        if (!cfg.reportTimestamps) syncConfig('reportTimestamps', s.reportTimestamps)

        flush() // replay anything queued while offline
        return true
      },

      // Poll/focus refresh so devices converge on the shared state.
      refresh: async () => {
        if (!isSyncEnabled()) return
        flush() // opportunistically drain the outbox
        try {
          const data = await getBootstrap()
          if (data && data.configured) get()._applyServer(data)
        } catch {
          /* keep local state on a transient failure */
        }
      },

      // ---- Locations (Owner) ------------------------------------------------
      addLocation: ({ name, code, city, province }) =>
        set((s) => {
          const loc = { id: newId('LOC'), name, code: code.toUpperCase(), city, province, active: true }
          syncCreate('locations', loc)
          return { locations: [...s.locations, loc] }
        }),
      updateLocation: (id, partial) => {
        syncUpdate('locations', id, partial)
        set((s) => ({ locations: s.locations.map((l) => (l.id === id ? { ...l, ...partial } : l)) }))
      },
      toggleLocationActive: (id) =>
        set((s) => {
          const cur = s.locations.find((l) => l.id === id)
          const active = !cur?.active
          syncUpdate('locations', id, { active })
          return { locations: s.locations.map((l) => (l.id === id ? { ...l, active } : l)) }
        }),

      // ---- Accounts / Managers (Owner) -------------------------------------
      addManager: ({ name, email, password, locationId }) =>
        set((s) => {
          const acct = { id: newId('ACC'), name, email, password, role: 'manager', locationId }
          syncCreate('accounts', acct)
          return { accounts: [...s.accounts, acct] }
        }),
      removeManager: (id) =>
        set((s) => {
          const target = s.accounts.find((a) => a.id === id)
          if (target && target.role !== 'owner') syncDelete('accounts', id)
          return { accounts: s.accounts.filter((a) => a.id !== id || a.role === 'owner') }
        }),

      // ---- Staff / Drivers (Manager) ---------------------------------------
      addStaff: ({ name, employeeId, locationId }) =>
        set((s) => {
          const driver = {
            id: newId('D'),
            name,
            initials: initialsFromName(name),
            employeeId,
            status: 'active',
            locationId,
            notes: '',
          }
          syncCreate('drivers', driver)
          return { drivers: [...s.drivers, driver] }
        }),
      updateStaff: (id, partial) => {
        syncUpdate('drivers', id, partial)
        set((s) => ({ drivers: s.drivers.map((d) => (d.id === id ? { ...d, ...partial } : d)) }))
      },
      updateDriverNotes: (id, notes) => {
        syncUpdate('drivers', id, { notes })
        set((s) => ({ drivers: s.drivers.map((d) => (d.id === id ? { ...d, notes } : d)) }))
      },

      // ---- Vehicles (Manager) ----------------------------------------------
      addVehicle: ({ busNum, make, model, year, capacity, odometer, locationId }) =>
        set((s) => {
          const vehicle = {
            id: newId('V'),
            busNum,
            make,
            model,
            year: Number(year),
            capacity: Number(capacity),
            odometer: Number(odometer) || 0,
            status: 'idle',
            lastInspection: null,
            inspectionResult: null,
            nextServiceDue: null,
            maintenanceNotes: 'Newly added vehicle — awaiting first inspection.',
            locationId,
          }
          syncCreate('vehicles', vehicle)
          return { vehicles: [...s.vehicles, vehicle] }
        }),
      setVehicleStatus: (vehicleId, status, reason) =>
        set((s) => {
          const cur = s.vehicles.find((v) => v.id === vehicleId)
          const downReason = status === 'out-of-service' ? reason || cur?.downReason || null : null
          syncUpdate('vehicles', vehicleId, { status, downReason })
          return {
            vehicles: s.vehicles.map((v) => (v.id === vehicleId ? { ...v, status, downReason } : v)),
          }
        }),
      flagVehicle: (vehicleId, flagged = true) => {
        const status = flagged ? 'flagged' : 'active'
        syncUpdate('vehicles', vehicleId, { status })
        set((s) => ({
          vehicles: s.vehicles.map((v) => (v.id === vehicleId ? { ...v, status } : v)),
        }))
      },
      updateMaintenanceNotes: (vehicleId, notes) => {
        syncUpdate('vehicles', vehicleId, { maintenanceNotes: notes })
        set((s) => ({
          vehicles: s.vehicles.map((v) => (v.id === vehicleId ? { ...v, maintenanceNotes: notes } : v)),
        }))
      },

      // ---- Incidents -------------------------------------------------------
      addIncident: (incident) =>
        set((s) => {
          const rec = {
            id: newId('INC'),
            status: 'open',
            managerNotes: '',
            createdAt: new Date().toISOString(),
            ...incident,
          }
          syncCreate('incidents', rec)
          return { incidents: [rec, ...s.incidents] }
        }),
      updateIncident: (id, partial) => {
        syncUpdate('incidents', id, partial)
        set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? { ...i, ...partial } : i)) }))
      },

      // ---- Critical / auto-pull config (Manager) ---------------------------
      toggleCriticalItem: (key) =>
        set((s) => {
          const criticalItems = s.criticalItems.includes(key)
            ? s.criticalItems.filter((k) => k !== key)
            : [...s.criticalItems, key]
          syncConfig('criticalItems', criticalItems)
          return { criticalItems }
        }),

      // ---- Commit a finished driver shift into the system ------------------
      // Called by the driver app on End Shift. Appends the shift + inspection,
      // updates the vehicle, and auto-pulls the bus if a critical item failed.
      commitShift: ({ shift, inspection, incidents = [] }) => {
        const s = get()
        const shifts = [...s.shifts, shift]
        const inspections = inspection ? [...s.inspections, inspection] : s.inspections

        // Determine auto-down from critical inspection failures.
        let autoDown = false
        let downReason = null
        if (inspection) {
          const failedCritical = Object.entries(inspection.results || {})
            .filter(([k, v]) => v === 'fail' && s.criticalItems.includes(k))
            .map(([k]) => k)
          if (failedCritical.length > 0) {
            autoDown = true
            const labels = failedCritical
              .map((k) => inspectionGroups.flatMap((g) => g.items).find((i) => i.key === k)?.label || k)
              .join(', ')
            downReason = `Auto-pulled: critical inspection failure (${labels})`
          }
        }

        let vehiclePatch = null
        const vehicles = s.vehicles.map((v) => {
          if (v.id !== shift.vehicleId) return v
          const next = {
            ...v,
            odometer: shift.odoEnd ?? v.odometer,
            lastInspection: inspection?.date ?? v.lastInspection,
            inspectionResult: inspection?.overallResult ?? v.inspectionResult,
          }
          if (autoDown) {
            next.status = 'out-of-service'
            next.downReason = downReason
            next.maintenanceNotes = `${downReason}. ${v.maintenanceNotes || ''}`.trim()
          } else if (inspection?.overallResult === 'fail') {
            next.status = 'flagged'
          }
          vehiclePatch = {
            odometer: next.odometer,
            lastInspection: next.lastInspection ?? null,
            inspectionResult: next.inspectionResult ?? null,
            status: next.status,
            downReason: next.downReason ?? null,
            maintenanceNotes: next.maintenanceNotes,
          }
          return next
        })

        const newIncidentRecords = incidents.length
          ? incidents.map((inc) => ({
              id: newId('INC'),
              status: 'open',
              managerNotes: '',
              createdAt: new Date().toISOString(),
              ...inc,
            }))
          : []
        const newIncidents = newIncidentRecords.length ? [...newIncidentRecords, ...s.incidents] : s.incidents

        set({
          shifts,
          inspections,
          vehicles,
          trips: flattenTrips(shifts),
          incidents: newIncidents,
          _autoDown: { autoDown, downReason, vehicleId: shift.vehicleId },
        })

        // Persist atomically — one transaction so a critically-failed bus can't
        // stay "active" if only part of the write lands.
        syncCommitShift({
          shift,
          inspection: inspection || null,
          incidents: newIncidentRecords,
          vehicleId: vehiclePatch ? shift.vehicleId : null,
          vehiclePatch: vehiclePatch || null,
        })
      },

      // ---- Settings / misc -------------------------------------------------
      updateSettings: (partial) =>
        set((s) => {
          const settings = { ...s.settings, ...partial }
          syncConfig('settings', settings)
          return { settings }
        }),
      toggleNotification: (key) =>
        set((s) => {
          const settings = {
            ...s.settings,
            notifications: { ...s.settings.notifications, [key]: !s.settings.notifications[key] },
          }
          syncConfig('settings', settings)
          return { settings }
        }),
      toggleChecklistItem: (key) =>
        set((s) => {
          const checklist = s.checklist.map((c) => (c.key === key ? { ...c, active: !c.active } : c))
          syncConfig('checklist', checklist)
          return { checklist }
        }),
      markReportGenerated: (type) =>
        set((s) => {
          const reportTimestamps = { ...s.reportTimestamps, [type]: new Date().toISOString() }
          syncConfig('reportTimestamps', reportTimestamps)
          return { reportTimestamps }
        }),

      // Clear operational data. When synced, also clears it on the server
      // (owner-only) so the reset is real across devices; otherwise local-only.
      resetSystem: async () => {
        if (isSyncEnabled()) {
          try {
            await resetSystemRequest()
          } catch {
            useToastStore.getState().addToast('Could not clear server data — try again.', 'warning')
            return false
          }
        }
        set({ ...seed() })
        return true
      },
    }),
    {
      name: DEMO ? 'shuttlelog-manager' : 'parknfly-manager',
      version: 4,
      // Guard against localStorage quota errors (e.g. many inspection photos):
      // a failed write is swallowed so the app never crashes — in-memory state
      // stands and the server remains the source of truth.
      storage: createJSONStorage(() => ({
        getItem: (k) => {
          try { return localStorage.getItem(k) } catch { return null }
        },
        setItem: (k, v) => {
          try { localStorage.setItem(k, v) } catch { /* quota exceeded — skip */ }
        },
        removeItem: (k) => {
          try { localStorage.removeItem(k) } catch { /* ignore */ }
        },
      })),
      // In live (blank) mode, always track the real current date rather than
      // freezing referenceToday at first-load.
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted || {}) }
        if (!DEMO) merged.referenceToday = todayKey()
        return merged
      },
    },
  ),
)

// ---- Location scoping helpers --------------------------------------------
const inLoc = (locId) => (item) => !locId || item.locationId === locId

export const scopeData = (state, locationId) => ({
  drivers: state.drivers.filter(inLoc(locationId)),
  vehicles: state.vehicles.filter(inLoc(locationId)),
  shifts: state.shifts.filter(inLoc(locationId)),
  trips: state.trips.filter(inLoc(locationId)),
  inspections: state.inspections.filter((i) => {
    if (!locationId) return true
    const v = state.vehicles.find((x) => x.id === i.vehicleId)
    return v ? v.locationId === locationId : true
  }),
  incidents: state.incidents.filter(inLoc(locationId)),
})

// ---- Aggregation selectors -----------------------------------------------
export const selectTodayShiftsFor = (state, locationId) =>
  state.shifts.filter((s) => s.date === state.referenceToday && inLoc(locationId)(s))

export const selectTodayKpisFor = (state, locationId) => {
  const { trips, vehicles, shifts, incidents } = scopeData(state, locationId)
  const todayTrips = trips.filter((t) => t.date === state.referenceToday)
  const completed = todayTrips.filter((t) => t.status === 'complete')
  const totalPax = todayTrips.reduce((sum, t) => sum + (t.paxToAirport || 0) + (t.paxFromAirport || 0), 0)
  const activeShifts = shifts.filter((s) => s.date === state.referenceToday && s.status === 'active')
  const activeVehicleIds = new Set(activeShifts.map((s) => s.vehicleId))
  const idleVehicles = vehicles.filter(
    (v) => !activeVehicleIds.has(v.id) && v.status !== 'out-of-service',
  )
  const flaggedVehicles = vehicles.filter((v) => v.status === 'flagged' || v.status === 'out-of-service')
  const openIncidents = incidents.filter((i) => i.status !== 'resolved')

  return {
    totalTrips: completed.length,
    totalPax,
    activeVehicles: activeVehicleIds.size,
    idleVehicles: idleVehicles.length,
    flaggedItems: flaggedVehicles.length,
    openIncidents: openIncidents.length,
  }
}

export default useManagerStore
