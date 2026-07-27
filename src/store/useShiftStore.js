/**
 * useShiftStore — current driver shift state (driver app).
 *
 * BACKEND: This entire store simulates the live shift record. On migration:
 *   - startShift()      → POST /Shifts (create record), POST /Inspections placeholder
 *   - logStep()         → PATCH /Trips (update current trip leg timestamp)
 *   - completeTrip()    → POST /Trips (finalize trip record)
 *   - saveInspection()  → PATCH /Inspections (write results + signature)
 *   - endShift()        → PATCH /Shifts (set End_Time, Odo_End)
 *
 * Persisted to localStorage so a tablet refresh mid-shift keeps state.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { allInspectionItems } from '../data/inspectionItems'
import { minutesBetween } from '../utils/formatters'

const emptyTrip = () => ({
  departLotTime: null,
  arriveAirportTime: null,
  departAirportTime: null,
  arriveLotTime: null,
  paxToAirport: 0,
  paxFromAirport: 0,
})

const emptyInspectionResults = () =>
  allInspectionItems.reduce((acc, item) => {
    acc[item.key] = null // null = not checked, 'pass' | 'fail'
    return acc
  }, {})

const initialState = {
  // Shift setup
  shiftStarted: false,
  driverId: '',
  vehicleId: '',
  locationId: '',
  shiftDate: '',
  odoStart: '',
  odoEnd: '',
  fuelLitres: '',
  startedAt: null,

  // Incidents filed during this shift
  incidents: [],

  // Break / pause periods: [{ start, end }]
  breaks: [],

  // Inspection
  inspectionComplete: false,
  inspectionResults: emptyInspectionResults(),
  fuelLevel: '',
  inspectionNotes: '',
  inspectionSignature: '',
  inspectionPhotos: [],

  // Trips
  currentStep: 1, // 1–4, the next action to perform
  currentTripNum: 1,
  currentTrip: emptyTrip(),
  trips: [], // completed trips
}

export const useShiftStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      startShift: ({ driverId, vehicleId, locationId, shiftDate, odoStart }) =>
        set({
          shiftStarted: true,
          driverId,
          vehicleId,
          locationId,
          shiftDate,
          odoStart,
          fuelLitres: '',
          incidents: [],
          breaks: [],
          startedAt: new Date().toISOString(),
          currentStep: 1,
          currentTripNum: 1,
          currentTrip: emptyTrip(),
          trips: [],
        }),

      setFuelLitres: (fuelLitres) => set({ fuelLitres }),

      // Break / pause tracking
      startBreak: () =>
        set((s) => (s.breaks.some((b) => !b.end) ? {} : { breaks: [...s.breaks, { start: new Date().toISOString(), end: null }] })),
      endBreak: () =>
        set((s) => ({ breaks: s.breaks.map((b) => (b.end ? b : { ...b, end: new Date().toISOString() })) })),

      // Incident reports filed by the driver during the shift.
      addShiftIncident: (incident) =>
        set((s) => ({
          incidents: [...s.incidents, { id: `local-INC-${Date.now()}`, ...incident }],
        })),
      removeShiftIncident: (id) =>
        set((s) => ({ incidents: s.incidents.filter((i) => i.id !== id) })),

      // Passenger counters
      setPaxToAirport: (value) =>
        set((s) => ({ currentTrip: { ...s.currentTrip, paxToAirport: clamp(value, 0, 20) } })),
      setPaxFromAirport: (value) =>
        set((s) => ({ currentTrip: { ...s.currentTrip, paxFromAirport: clamp(value, 0, 20) } })),

      // Log the timestamp for the given step (1–4). Auto-advances.
      logStep: (step) => {
        const now = new Date().toISOString()
        const s = get()
        if (step !== s.currentStep) return // enforce in-order

        if (step === 1) {
          set({
            currentTrip: { ...s.currentTrip, departLotTime: now },
            currentStep: 2,
          })
        } else if (step === 2) {
          set({
            currentTrip: { ...s.currentTrip, arriveAirportTime: now },
            currentStep: 3,
          })
        } else if (step === 3) {
          set({
            currentTrip: { ...s.currentTrip, departAirportTime: now },
            currentStep: 4,
          })
        } else if (step === 4) {
          const finished = { ...s.currentTrip, arriveLotTime: now }
          const completedTrip = {
            id: `local-T${s.currentTripNum}`,
            tripNumber: s.currentTripNum,
            ...finished,
            durationMin: minutesBetween(finished.departLotTime, finished.arriveLotTime),
            status: 'complete',
          }
          set({
            trips: [...s.trips, completedTrip],
            currentTripNum: s.currentTripNum + 1,
            currentTrip: emptyTrip(),
            currentStep: 1,
          })
        }
      },

      // Undo the most recent logged step. Within a trip it reverts one leg;
      // at the start of a fresh trip it reopens the previous completed trip.
      undoLastStep: () => {
        const s = get()
        const ct = s.currentTrip
        if (s.currentStep === 4 && ct.departAirportTime) {
          set({ currentTrip: { ...ct, departAirportTime: null }, currentStep: 3 })
        } else if (s.currentStep === 3 && ct.arriveAirportTime) {
          set({ currentTrip: { ...ct, arriveAirportTime: null }, currentStep: 2 })
        } else if (s.currentStep === 2 && ct.departLotTime) {
          set({ currentTrip: { ...ct, departLotTime: null }, currentStep: 1 })
        } else if (s.currentStep === 1 && !ct.departLotTime && s.trips.length > 0) {
          const last = s.trips[s.trips.length - 1]
          set({
            trips: s.trips.slice(0, -1),
            currentTripNum: s.currentTripNum - 1,
            currentStep: 4,
            currentTrip: {
              departLotTime: last.departLotTime,
              arriveAirportTime: last.arriveAirportTime,
              departAirportTime: last.departAirportTime,
              arriveLotTime: null,
              paxToAirport: last.paxToAirport,
              paxFromAirport: last.paxFromAirport,
            },
          })
        }
      },

      // Discard the in-progress trip without saving.
      cancelCurrentTrip: () => set({ currentTrip: emptyTrip(), currentStep: 1 }),

      // Correct a logged time on the in-progress trip.
      setCurrentTripTime: (field, iso) =>
        set((s) => ({ currentTrip: { ...s.currentTrip, [field]: iso } })),

      // Edit a saved trip's times / passenger counts (recomputes duration).
      updateCompletedTrip: (tripNumber, patch) =>
        set((s) => ({
          trips: s.trips.map((t) => {
            if (t.tripNumber !== tripNumber) return t
            const merged = { ...t, ...patch }
            merged.durationMin = minutesBetween(merged.departLotTime, merged.arriveLotTime)
            return merged
          }),
        })),

      // Inspection actions
      setInspectionItem: (key, value) =>
        set((s) => ({ inspectionResults: { ...s.inspectionResults, [key]: value } })),
      setFuelLevel: (fuelLevel) => set({ fuelLevel }),
      setInspectionNotes: (inspectionNotes) => set({ inspectionNotes }),
      setInspectionSignature: (inspectionSignature) => set({ inspectionSignature }),
      setInspectionPhotos: (inspectionPhotos) => set({ inspectionPhotos }),
      saveInspection: () => set({ inspectionComplete: true }),

      setOdoEnd: (odoEnd) => set({ odoEnd }),

      endShift: () => set({ ...initialState, inspectionResults: emptyInspectionResults() }),
      reset: () => set({ ...initialState, inspectionResults: emptyInspectionResults() }),
    }),
    {
      name: 'shuttlelog-driver-shift',
    },
  ),
)

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

// Total break minutes (counts an open break up to `nowMs`).
export const selectBreakMinutes = (breaks = [], nowMs = Date.now()) =>
  breaks.reduce(
    (sum, b) => sum + Math.max(0, Math.round(((b.end ? new Date(b.end) : nowMs) - new Date(b.start)) / 60000)),
    0,
  )

export const selectOnBreak = (breaks = []) => breaks.some((b) => !b.end)

// Derived selectors (call with store values) -------------------------------
export const selectTripTotals = (trips) => {
  const totalTrips = trips.length
  const paxTo = trips.reduce((sum, t) => sum + (t.paxToAirport || 0), 0)
  const paxFrom = trips.reduce((sum, t) => sum + (t.paxFromAirport || 0), 0)
  return { totalTrips, paxTo, paxFrom, totalPax: paxTo + paxFrom }
}
