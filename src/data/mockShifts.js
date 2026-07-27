/**
 * MOCK DATA — ShuttleLog Halifax
 * Data store: Railway Postgres
 * Table: Shifts (+ linked Trips)
 * Replace this file with: useFetchShifts() hook → the backend API
 *
 * BACKEND: Replace with → GET /Shifts table + linked /Trips table
 * Shift fields: Shift_ID, Driver_ID, Vehicle_ID, Date, Start_Time,
 *               End_Time, Odo_Start, Odo_End
 * Trip fields:  Trip_Number, Depart_Lot_Time, Arrive_Airport_Time,
 *               Depart_Airport_Time, Arrive_Lot_Time, Pax_To_Airport,
 *               Pax_From_Airport, Vehicle_ID, Driver_ID, Shift_ID
 *
 * Data is generated deterministically (seeded PRNG) so the demo is stable
 * across reloads. "Today" (relative to TODAY below) contains in-progress
 * shifts so the manager dashboard shows live fleet status.
 */

// Anchor the dataset to the project's reference date.
const TODAY = '2026-06-18'

// ---- Deterministic PRNG (mulberry32) -------------------------------------
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

const rand = mulberry32(20260618)
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

// ---- Helpers --------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0')

function isoAt(dateStr, totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${dateStr}T${pad(h)}:${pad(m)}:00`
}

function addDaysISO(dateStr, delta) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Driver / vehicle pools (mirrors mockDrivers / mockVehicles).
const ACTIVE_DRIVERS = ['D001', 'D002', 'D003', 'D004', 'D005']
const SERVICE_VEHICLES = ['V001', 'V002', 'V004'] // V003 is flagged / out

// Build a single trip starting at `startMin` (minutes from midnight).
// Returns { trip, endMin }.
function buildTrip(dateStr, tripNumber, startMin, opts = {}) {
  const legOut = randInt(6, 10) // lot -> airport
  const dwellAirport = randInt(3, 6) // unload + load
  const legBack = randInt(6, 10) // airport -> lot
  const dwellLot = randInt(2, 5) // unload + reset

  const departLot = startMin
  const arriveAirport = departLot + legOut
  const departAirport = arriveAirport + dwellAirport
  const arriveLot = departAirport + legBack
  const endMin = arriveLot + dwellLot

  const paxToAirport = randInt(2, 14)
  const paxFromAirport = randInt(2, 14)

  // `stage` lets us build an in-progress trip for "today" (null later fields).
  const stage = opts.stage ?? 4
  const trip = {
    id: `${opts.shiftId}-T${tripNumber}`,
    shiftId: opts.shiftId,
    driverId: opts.driverId,
    vehicleId: opts.vehicleId,
    tripNumber,
    departLotTime: stage >= 1 ? isoAt(dateStr, departLot) : null,
    paxToAirport: stage >= 1 ? paxToAirport : 0,
    arriveAirportTime: stage >= 2 ? isoAt(dateStr, arriveAirport) : null,
    departAirportTime: stage >= 3 ? isoAt(dateStr, departAirport) : null,
    paxFromAirport: stage >= 3 ? paxFromAirport : 0,
    arriveLotTime: stage >= 4 ? isoAt(dateStr, arriveLot) : null,
    status: stage >= 4 ? 'complete' : 'in-progress',
  }
  return { trip, endMin }
}

function buildShift({ shiftId, driverId, vehicleId, dateStr, odoStart, inProgress, completedTrips, currentStage }) {
  const startMin = randInt(6 * 60, 6 * 60 + 30) // 6:00–6:30 am
  let cursor = startMin
  const trips = []

  const totalTrips = inProgress ? completedTrips + 1 : randInt(6, 14)

  for (let i = 1; i <= totalTrips; i++) {
    const isLast = i === totalTrips
    const stage = inProgress && isLast ? currentStage : 4
    const { trip, endMin } = buildTrip(dateStr, i, cursor, {
      shiftId,
      driverId,
      vehicleId,
      stage,
    })
    trips.push(trip)
    // gap before next trip (driver waits / boards): 4–14 min
    cursor = endMin + randInt(4, 14)
  }

  const odoEnd = inProgress ? null : odoStart + randInt(120, 210)
  const lastComplete = [...trips].reverse().find((t) => t.arriveLotTime)
  const endTime = inProgress ? null : lastComplete ? lastComplete.arriveLotTime : isoAt(dateStr, cursor)

  return {
    id: shiftId,
    driverId,
    vehicleId,
    locationId: 'LOC-HFX', // seed data is the Halifax lot
    date: dateStr,
    startTime: isoAt(dateStr, startMin),
    endTime,
    odoStart,
    odoEnd,
    fuelLitres: inProgress ? null : randInt(28, 55),
    status: inProgress ? 'active' : 'complete',
    // Seed completed shifts all have a fully-completed inspection on record.
    inspectionStatus: inProgress ? null : 'complete',
    inspectionComplete: inProgress ? false : true,
    trips,
  }
}

// ---- Generate 14 days of shifts ------------------------------------------
function generateShifts() {
  const shifts = []
  let shiftSeq = 1

  // Track a rolling odometer per vehicle so values increase over time.
  const odo = { V001: 86200, V002: 90800, V003: 134200, V004: 107100 }

  // Iterate oldest -> newest: 13 days ago up to today.
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const dateStr = addDaysISO(TODAY, -dayOffset)
    const isToday = dateStr === TODAY

    // 2–3 shifts per day across the service vehicles.
    const shiftCount = isToday ? 3 : randInt(2, 3)
    const driversToday = [...ACTIVE_DRIVERS].sort(() => rand() - 0.5).slice(0, shiftCount)
    const vehiclesToday = [...SERVICE_VEHICLES]

    driversToday.forEach((driverId, idx) => {
      const vehicleId = vehiclesToday[idx % vehiclesToday.length]
      const shiftId = `S${pad(shiftSeq++)}`

      let shift
      if (isToday) {
        // First shift mid-trip, second mostly done, third early.
        const config = [
          { completedTrips: 4, currentStage: 2 }, // at airport
          { completedTrips: 6, currentStage: 3 }, // returning
          { completedTrips: 2, currentStage: 1 }, // departing
        ][idx] || { completedTrips: 3, currentStage: 1 }

        shift = buildShift({
          shiftId,
          driverId,
          vehicleId,
          dateStr,
          odoStart: odo[vehicleId],
          inProgress: true,
          completedTrips: config.completedTrips,
          currentStage: config.currentStage,
        })
      } else {
        shift = buildShift({
          shiftId,
          driverId,
          vehicleId,
          dateStr,
          odoStart: odo[vehicleId],
          inProgress: false,
        })
        odo[vehicleId] = shift.odoEnd
      }
      shifts.push(shift)
    })

    // Occasionally Bus 3 (flagged) ran in the earlier part of the window.
    if (!isToday && dayOffset > 3 && rand() > 0.55) {
      const shiftId = `S${pad(shiftSeq++)}`
      const driverId = pick(ACTIVE_DRIVERS)
      const shift = buildShift({
        shiftId,
        driverId,
        vehicleId: 'V003',
        dateStr,
        odoStart: odo.V003,
        inProgress: false,
      })
      odo.V003 = shift.odoEnd
      shifts.push(shift)
    }
  }

  return shifts
}

export const mockShifts = generateShifts()

// Convenience selectors -----------------------------------------------------
export const getShiftById = (id) => mockShifts.find((s) => s.id === id)

export const getShiftsByDate = (dateStr) => mockShifts.filter((s) => s.date === dateStr)

export const getTodayShifts = () => getShiftsByDate(TODAY)

// Flattened list of every trip across all shifts (with shift context).
export const flattenTrips = (shifts) =>
  shifts.flatMap((shift) =>
    shift.trips.map((trip) => ({
      ...trip,
      date: shift.date,
      driverId: shift.driverId,
      vehicleId: shift.vehicleId,
      locationId: shift.locationId,
      shiftId: shift.id,
    })),
  )

export const allTrips = flattenTrips(mockShifts)

export const REFERENCE_TODAY = TODAY

export default mockShifts
