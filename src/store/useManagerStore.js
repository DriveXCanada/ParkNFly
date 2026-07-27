/**
 * useManagerStore — system of record for the manager/owner side.
 *
 * Holds locations, accounts (owner + managers), staff (drivers), vehicles,
 * shifts, trips, inspections, incidents, and configuration. Seeded from the
 * mock data files, then PERSISTED to localStorage so everything you add
 * (locations, managers, staff, vehicles, incidents, notes) survives reloads.
 *
 * AIRTABLE: each collection maps to an Airtable table; every mutation below
 * becomes a POST/PATCH. Swap the seed imports + persist layer for fetch hooks.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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

      // ---- Locations (Owner) ------------------------------------------------
      // AIRTABLE: POST /Locations
      addLocation: ({ name, code, city, province }) =>
        set((s) => ({
          locations: [
            ...s.locations,
            { id: newId('LOC'), name, code: code.toUpperCase(), city, province, active: true },
          ],
        })),
      updateLocation: (id, partial) =>
        set((s) => ({ locations: s.locations.map((l) => (l.id === id ? { ...l, ...partial } : l)) })),
      toggleLocationActive: (id) =>
        set((s) => ({ locations: s.locations.map((l) => (l.id === id ? { ...l, active: !l.active } : l)) })),

      // ---- Accounts / Managers (Owner) -------------------------------------
      // AIRTABLE: POST /Accounts (role = manager)
      addManager: ({ name, email, password, locationId }) =>
        set((s) => ({
          accounts: [
            ...s.accounts,
            { id: newId('ACC'), name, email, password, role: 'manager', locationId },
          ],
        })),
      removeManager: (id) =>
        set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id || a.role === 'owner') })),

      // ---- Staff / Drivers (Manager) ---------------------------------------
      // AIRTABLE: POST /Drivers
      addStaff: ({ name, employeeId, locationId }) =>
        set((s) => ({
          drivers: [
            ...s.drivers,
            {
              id: newId('D'),
              name,
              initials: initialsFromName(name),
              employeeId,
              status: 'active',
              locationId,
              notes: '',
            },
          ],
        })),
      updateStaff: (id, partial) =>
        set((s) => ({ drivers: s.drivers.map((d) => (d.id === id ? { ...d, ...partial } : d)) })),
      updateDriverNotes: (id, notes) =>
        set((s) => ({ drivers: s.drivers.map((d) => (d.id === id ? { ...d, notes } : d)) })),

      // ---- Vehicles (Manager) ----------------------------------------------
      // AIRTABLE: POST /Vehicles
      addVehicle: ({ busNum, make, model, year, capacity, odometer, locationId }) =>
        set((s) => ({
          vehicles: [
            ...s.vehicles,
            {
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
            },
          ],
        })),
      // AIRTABLE: PATCH /Vehicles → Status
      setVehicleStatus: (vehicleId, status, reason) =>
        set((s) => ({
          vehicles: s.vehicles.map((v) =>
            v.id === vehicleId
              ? { ...v, status, downReason: status === 'out-of-service' ? reason || v.downReason : null }
              : v,
          ),
        })),
      flagVehicle: (vehicleId, flagged = true) =>
        set((s) => ({
          vehicles: s.vehicles.map((v) =>
            v.id === vehicleId ? { ...v, status: flagged ? 'flagged' : 'active' } : v,
          ),
        })),
      updateMaintenanceNotes: (vehicleId, notes) =>
        set((s) => ({
          vehicles: s.vehicles.map((v) => (v.id === vehicleId ? { ...v, maintenanceNotes: notes } : v)),
        })),

      // ---- Incidents -------------------------------------------------------
      // AIRTABLE: POST /Incidents
      addIncident: (incident) =>
        set((s) => ({
          incidents: [
            {
              id: newId('INC'),
              status: 'open',
              managerNotes: '',
              createdAt: new Date().toISOString(),
              ...incident,
            },
            ...s.incidents,
          ],
        })),
      updateIncident: (id, partial) =>
        set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? { ...i, ...partial } : i)) })),

      // ---- Critical / auto-pull config (Manager) ---------------------------
      toggleCriticalItem: (key) =>
        set((s) => ({
          criticalItems: s.criticalItems.includes(key)
            ? s.criticalItems.filter((k) => k !== key)
            : [...s.criticalItems, key],
        })),

      // ---- Commit a finished driver shift into the system ------------------
      // Called by the driver app on End Shift. Appends the shift + inspection,
      // updates the vehicle, and auto-pulls the bus if a critical item failed.
      // AIRTABLE: POST /Shifts, POST /Inspections, PATCH /Vehicles
      commitShift: ({ shift, inspection, incidents = [] }) =>
        set((s) => {
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
            return next
          })

          const newIncidents = incidents.length
            ? [
                ...incidents.map((inc) => ({
                  id: newId('INC'),
                  status: 'open',
                  managerNotes: '',
                  createdAt: new Date().toISOString(),
                  ...inc,
                })),
                ...s.incidents,
              ]
            : s.incidents

          return { shifts, inspections, vehicles, trips: flattenTrips(shifts), incidents: newIncidents, _autoDown: { autoDown, downReason, vehicleId: shift.vehicleId } }
        }),

      // ---- Settings / misc -------------------------------------------------
      updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
      toggleNotification: (key) =>
        set((s) => ({
          settings: {
            ...s.settings,
            notifications: { ...s.settings.notifications, [key]: !s.settings.notifications[key] },
          },
        })),
      toggleChecklistItem: (key) =>
        set((s) => ({ checklist: s.checklist.map((c) => (c.key === key ? { ...c, active: !c.active } : c)) })),
      markReportGenerated: (type) =>
        set((s) => ({ reportTimestamps: { ...s.reportTimestamps, [type]: new Date().toISOString() } })),

      // Wipe persisted data and re-seed from the mock files.
      resetSystem: () => set({ ...seed() }),
    }),
    {
      name: DEMO ? 'shuttlelog-manager' : 'parknfly-manager',
      version: 4,
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
