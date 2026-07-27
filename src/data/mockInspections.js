/**
 * MOCK DATA — ShuttleLog Halifax
 * Data store: Railway Postgres
 * Table: Inspections
 * Replace this file with: useFetchInspections() hook → the backend API
 *
 * BACKEND: Replace with → GET /Inspections table, filter by shiftId / vehicleId
 * Fields: Inspection_ID, Shift_ID, Driver_ID, Vehicle_ID, Date, Time,
 *         Results (JSON of item_key -> pass/fail), Fuel_Level, Notes,
 *         Signature, Overall_Result
 *
 * One pre-trip inspection per shift, keyed to mockShifts so IDs align.
 */

import { mockShifts } from './mockShifts'
import { allInspectionItems, fuelLevels } from './inspectionItems'

// Deterministic PRNG so inspection results are stable across reloads.
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(771026)

const PASS_NOTES = [
  'Vehicle in good operating condition. No defects noted.',
  'All systems checked and functioning normally.',
  'Pre-trip complete — cleared for service.',
  'Minor cosmetic wear only. Safe to operate.',
]

// Specific known defects so Bus 3 (V003) reads as a realistic failure.
const FAIL_ITEMS_V003 = ['ext_mirrors', 'ext_taillights']

function buildInspection(shift, index) {
  const isV003 = shift.vehicleId === 'V003'
  // ~8% of non-V003 shifts have a single minor fail; V003's latest fails.
  const forceFail = isV003 && index === 0
  const randomFail = !isV003 && rand() < 0.08

  const results = {}
  let failedKeys = []

  if (forceFail) {
    failedKeys = FAIL_ITEMS_V003
  } else if (randomFail) {
    failedKeys = [allInspectionItems[Math.floor(rand() * allInspectionItems.length)].key]
  }

  allInspectionItems.forEach((item) => {
    results[item.key] = failedKeys.includes(item.key) ? 'fail' : 'pass'
  })

  const overallResult = failedKeys.length > 0 ? 'fail' : 'pass'
  const fuelLevel = fuelLevels[Math.floor(rand() * fuelLevels.length)]

  // Inspection happens ~10 min before shift start.
  const inspTime = shift.startTime
    ? new Date(new Date(shift.startTime).getTime() - 10 * 60000).toISOString()
    : `${shift.date}T05:50:00`

  let notes = PASS_NOTES[Math.floor(rand() * PASS_NOTES.length)]
  if (overallResult === 'fail') {
    const labels = failedKeys.map(
      (k) => allInspectionItems.find((i) => i.key === k)?.label ?? k,
    )
    notes = `DEFECT(S) FOUND: ${labels.join('; ')}. Vehicle flagged for maintenance review before return to service.`
  }

  return {
    id: `INSP-${shift.id}`,
    shiftId: shift.id,
    driverId: shift.driverId,
    vehicleId: shift.vehicleId,
    date: shift.date,
    time: inspTime,
    results,
    fuelLevel,
    notes,
    signature: 'On file', // seed inspections were signed
    overallResult,
    complete: true,
    photos: [],
  }
}

// Build newest-first per vehicle so "index 0" = latest for that vehicle.
const byVehicle = {}
const ordered = [...mockShifts].sort((a, b) => (a.date < b.date ? 1 : -1))

export const mockInspections = ordered.map((shift) => {
  byVehicle[shift.vehicleId] = (byVehicle[shift.vehicleId] ?? -1) + 1
  return buildInspection(shift, byVehicle[shift.vehicleId])
})

// Selectors -----------------------------------------------------------------
export const getInspectionByShift = (shiftId) =>
  mockInspections.find((i) => i.shiftId === shiftId)

export const getInspectionsByVehicle = (vehicleId) =>
  mockInspections
    .filter((i) => i.vehicleId === vehicleId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

export const getFailedItems = (inspection) => {
  if (!inspection) return []
  return Object.entries(inspection.results)
    .filter(([, v]) => v === 'fail')
    .map(([key]) => key)
}

export default mockInspections
