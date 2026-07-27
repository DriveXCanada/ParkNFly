/**
 * analytics.js — aggregation helpers for the manager dashboard & reports.
 * Pure functions over the mock collections (shifts, trips, inspections).
 *
 * BACKEND: these computations would run server-side or via the backend formula
 * fields / rollups once migrated; kept client-side here for the concept.
 */

import { dateKey, formatDate, minutesBetween } from './formatters'

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6am … 11pm

const tripCompletedHour = (trip) => {
  const t = trip.arriveLotTime || trip.departLotTime
  return t ? new Date(t).getHours() : null
}

const addDays = (dateStr, delta) => {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return dateKey(d)
}

/** Hourly trip counts: today vs yesterday vs 7-day average. */
export function buildDailyTrend(trips, referenceToday) {
  const todayKey = referenceToday
  const yesterdayKey = addDays(referenceToday, -1)
  const last7Keys = Array.from({ length: 7 }, (_, i) => addDays(referenceToday, -(i + 1)))

  const countByHour = (filterKeys) => {
    const map = {}
    HOURS.forEach((h) => (map[h] = 0))
    trips
      .filter((t) => t.status === 'complete' && filterKeys.includes(t.date))
      .forEach((t) => {
        const h = tripCompletedHour(t)
        if (h != null && map[h] != null) map[h]++
      })
    return map
  }

  const todayMap = countByHour([todayKey])
  const yestMap = countByHour([yesterdayKey])
  const weekMap = countByHour(last7Keys)

  return HOURS.map((h) => ({
    hour: h,
    label: formatHour(h),
    today: todayMap[h],
    yesterday: yestMap[h],
    avg: Math.round((weekMap[h] / 7) * 10) / 10,
  }))
}

function formatHour(h) {
  const ampm = h >= 12 ? 'p' : 'a'
  const hr = h % 12 || 12
  return `${hr}${ampm}`
}

/** Chronological feed of today's trip events (most recent first). */
export function buildActivityFeed(shifts, referenceToday, drivers, vehicles, limit = 40) {
  const driverName = (id) => drivers.find((d) => d.id === id)?.name || id
  const vehicleNum = (id) => vehicles.find((v) => v.id === id)?.busNum || id

  const events = []
  shifts
    .filter((s) => s.date === referenceToday)
    .forEach((shift) => {
      shift.trips.forEach((trip) => {
        const ctx = { driver: driverName(shift.driverId), vehicle: vehicleNum(shift.vehicleId), tripNum: trip.tripNumber }
        if (trip.departLotTime)
          events.push({ ...ctx, time: trip.departLotTime, type: 'Departed lot', pax: trip.paxToAirport, color: 'green' })
        if (trip.arriveAirportTime)
          events.push({ ...ctx, time: trip.arriveAirportTime, type: 'Arrived at airport', pax: trip.paxToAirport, color: 'amber' })
        if (trip.departAirportTime)
          events.push({ ...ctx, time: trip.departAirportTime, type: 'Departed airport', pax: trip.paxFromAirport, color: 'info' })
        if (trip.arriveLotTime)
          events.push({ ...ctx, time: trip.arriveLotTime, type: 'Arrived at lot', pax: trip.paxFromAirport, color: 'green' })
      })
    })

  return events.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, limit)
}

/** Per-driver stats over a set of shifts. */
export function driverStats(driverId, shifts, inspections, referenceToday) {
  const myShifts = shifts.filter((s) => s.driverId === driverId)
  const today = myShifts.filter((s) => s.date === referenceToday)

  const allTrips = myShifts.flatMap((s) => s.trips)
  const completed = allTrips.filter((t) => t.status === 'complete')
  const todayTrips = today.flatMap((s) => s.trips).filter((t) => t.status === 'complete')

  const totalPax = completed.reduce((sum, t) => sum + (t.paxToAirport || 0) + (t.paxFromAirport || 0), 0)
  const todayPax = todayTrips.reduce((sum, t) => sum + (t.paxToAirport || 0) + (t.paxFromAirport || 0), 0)

  const myInspections = inspections.filter((i) => i.driverId === driverId)

  // Inspection compliance: of the driver's COMPLETED shifts, what fraction had
  // a fully completed (all items + signature) pre-trip inspection. Skipped or
  // partial inspections drag the score down; complete ones lift it.
  const endedShifts = myShifts.filter((s) => s.status === 'complete')
  const compliantShifts = endedShifts.filter((s) => s.inspectionStatus === 'complete')
  const complianceRate = endedShifts.length
    ? Math.round((compliantShifts.length / endedShifts.length) * 100)
    : 100
  const missedInspections = endedShifts.length - compliantShifts.length

  return {
    shiftCount: myShifts.length,
    totalTrips: completed.length,
    todayTrips: todayTrips.length,
    totalPax,
    todayPax,
    avgTripsPerShift: myShifts.length ? Math.round((completed.length / myShifts.length) * 10) / 10 : 0,
    complianceRate,
    endedShifts: endedShifts.length,
    compliantShifts: compliantShifts.length,
    missedInspections,
    onShiftToday: today.some((s) => s.status === 'active'),
    shifts: [...myShifts].sort((a, b) => (a.date < b.date ? 1 : -1)),
    inspections: myInspections,
  }
}

/** 30-day trips-per-day series for a driver (for the bar chart). */
export function driverDailySeries(driverId, shifts, referenceToday, days = 30) {
  const keys = Array.from({ length: days }, (_, i) => addDays(referenceToday, -(days - 1 - i)))
  const counts = {}
  keys.forEach((k) => (counts[k] = 0))
  shifts
    .filter((s) => s.driverId === driverId)
    .forEach((s) => {
      if (counts[s.date] != null) {
        counts[s.date] += s.trips.filter((t) => t.status === 'complete').length
      }
    })
  return keys.map((k) => ({
    date: k,
    label: new Date(`${k}T12:00:00`).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
    trips: counts[k],
  }))
}

/** Per-vehicle stats (fleet utilization + this week's trips). */
export function vehicleStats(vehicleId, shifts, inspections, referenceToday) {
  const myShifts = shifts.filter((s) => s.vehicleId === vehicleId)
  const weekKeys = Array.from({ length: 7 }, (_, i) => addDays(referenceToday, -i))
  const trips = myShifts.flatMap((s) => s.trips).filter((t) => t.status === 'complete')
  const weekTrips = myShifts
    .filter((s) => weekKeys.includes(s.date))
    .flatMap((s) => s.trips)
    .filter((t) => t.status === 'complete')
  const totalPax = trips.reduce((sum, t) => sum + (t.paxToAirport || 0) + (t.paxFromAirport || 0), 0)
  const myInspections = inspections
    .filter((i) => i.vehicleId === vehicleId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  const failedCount = myInspections.reduce(
    (sum, i) => sum + Object.values(i.results).filter((v) => v === 'fail').length,
    0,
  )
  return {
    totalTrips: trips.length,
    weekTrips: weekTrips.length,
    totalPax,
    inspections: myInspections,
    inspectionCount: myInspections.length,
    failedItems: failedCount,
  }
}

/**
 * Build the manager alerts feed from current data: maintenance due/overdue,
 * flagged/out-of-service vehicles, open incidents, and low-compliance drivers.
 */
export function buildAlerts({ vehicles = [], incidents = [], drivers = [], shifts = [], inspections = [] }, referenceToday) {
  const alerts = []
  const daysUntil = (dateStr) =>
    Math.round((new Date(`${dateStr}T12:00:00`) - new Date(`${referenceToday}T12:00:00`)) / 86400000)

  vehicles.forEach((v) => {
    if (v.status === 'out-of-service') {
      alerts.push({ id: `down-${v.id}`, severity: 'high', category: 'Fleet', title: `${v.busNum} is out of service`, detail: v.downReason || 'Marked out of service', link: '/manager/fleet' })
    } else if (v.status === 'flagged') {
      alerts.push({ id: `flag-${v.id}`, severity: 'medium', category: 'Fleet', title: `${v.busNum} flagged`, detail: 'Failed inspection — needs review', link: '/manager/fleet' })
    }
    if (v.nextServiceDue && v.status !== 'out-of-service') {
      const d = daysUntil(v.nextServiceDue)
      if (d < 0) {
        alerts.push({ id: `svc-${v.id}`, severity: 'high', category: 'Maintenance', title: `${v.busNum} service overdue`, detail: `Was due ${formatDate(v.nextServiceDue)} (${-d}d ago)`, link: '/manager/fleet' })
      } else if (d <= 7) {
        alerts.push({ id: `svc-${v.id}`, severity: 'medium', category: 'Maintenance', title: `${v.busNum} service due soon`, detail: `Due in ${d}d · ${formatDate(v.nextServiceDue)}`, link: '/manager/fleet' })
      }
    }
  })

  incidents
    .filter((i) => i.status !== 'resolved')
    .forEach((i) => {
      const sev = i.severity === 'Critical' || i.severity === 'High' ? 'high' : 'medium'
      alerts.push({ id: `inc-${i.id}`, severity: sev, category: 'Incident', title: `${i.type} — ${i.severity}`, detail: `${i.reportedBy || 'Driver'} · ${i.status}`, link: '/manager/incidents' })
    })

  drivers.forEach((d) => {
    const st = driverStats(d.id, shifts, inspections, referenceToday)
    if (st.endedShifts >= 3 && st.complianceRate < 80) {
      alerts.push({
        id: `comp-${d.id}`,
        severity: st.complianceRate < 60 ? 'high' : 'medium',
        category: 'Compliance',
        title: `${d.name}: low inspection compliance`,
        detail: `${st.complianceRate}% · ${st.missedInspections} missed/incomplete`,
        link: `/manager/drivers/${d.id}`,
      })
    }
  })

  const order = { high: 0, medium: 1, low: 2 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

/**
 * Operational timing averages over a set of trips: trip duration, airport
 * dwell, each leg, and turnaround (gap between consecutive trips on a shift).
 */
export function timingStats(trips) {
  const completed = trips.filter((t) => t.status === 'complete')
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null)

  const durations = []
  const dwell = []
  const legOut = []
  const legBack = []
  completed.forEach((t) => {
    const dur = minutesBetween(t.departLotTime, t.arriveLotTime)
    if (dur != null) durations.push(dur)
    const dw = minutesBetween(t.arriveAirportTime, t.departAirportTime)
    if (dw != null) dwell.push(dw)
    const lo = minutesBetween(t.departLotTime, t.arriveAirportTime)
    if (lo != null) legOut.push(lo)
    const lb = minutesBetween(t.departAirportTime, t.arriveLotTime)
    if (lb != null) legBack.push(lb)
  })

  // Turnaround: gap between consecutive trips within the same shift.
  const gaps = []
  const byShift = {}
  completed.forEach((t) => {
    ;(byShift[t.shiftId] = byShift[t.shiftId] || []).push(t)
  })
  Object.values(byShift).forEach((list) => {
    const sorted = [...list].sort((a, b) => ((a.departLotTime || '') < (b.departLotTime || '') ? -1 : 1))
    for (let i = 1; i < sorted.length; i++) {
      const g = minutesBetween(sorted[i - 1].arriveLotTime, sorted[i].departLotTime)
      if (g != null && g < 180) gaps.push(g) // ignore long breaks between blocks
    }
  })

  return {
    count: completed.length,
    avgDuration: avg(durations),
    avgDwell: avg(dwell),
    avgLegOut: avg(legOut),
    avgLegBack: avg(legBack),
    avgTurnaround: avg(gaps),
  }
}

/** Fuel log + economy (L/100km) for a vehicle, derived from shift records. */
export function fuelStats(vehicleId, shifts) {
  const entries = shifts
    .filter((s) => s.vehicleId === vehicleId && s.fuelLitres != null && s.fuelLitres > 0)
    .map((s) => {
      const km = s.odoEnd != null && s.odoStart != null ? s.odoEnd - s.odoStart : null
      return {
        date: s.date,
        litres: s.fuelLitres,
        km,
        l100: km && km > 0 ? Math.round((s.fuelLitres / km) * 1000) / 10 : null,
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const totalLitres = entries.reduce((sum, e) => sum + e.litres, 0)
  const totalKm = entries.reduce((sum, e) => sum + (e.km || 0), 0)
  const avgL100 = totalKm > 0 ? Math.round((totalLitres / totalKm) * 1000) / 10 : null

  return {
    entries,
    fills: entries.length,
    totalLitres: Math.round(totalLitres * 10) / 10,
    totalKm,
    avgL100,
  }
}

/** Aggregate stats over a date range (operations summary report). */
export function rangeSummary(shifts, inspections, drivers, vehicles, startKey, endKey) {
  const inRange = (d) => d >= startKey && d <= endKey
  const shiftsInRange = shifts.filter((s) => inRange(s.date))
  const days = new Set(shiftsInRange.map((s) => s.date)).size || 1

  const allTrips = shiftsInRange.flatMap((s) => s.trips).filter((t) => t.status === 'complete')
  const totalPax = allTrips.reduce((sum, t) => sum + (t.paxToAirport || 0) + (t.paxFromAirport || 0), 0)

  const byDriver = drivers.map((d) => {
    const ds = shiftsInRange.filter((s) => s.driverId === d.id)
    const ts = ds.flatMap((s) => s.trips).filter((t) => t.status === 'complete')
    const paxTo = ts.reduce((sum, t) => sum + (t.paxToAirport || 0), 0)
    const paxFrom = ts.reduce((sum, t) => sum + (t.paxFromAirport || 0), 0)
    return { name: d.name, shifts: ds.length, trips: ts.length, paxTo, paxFrom, totalPax: paxTo + paxFrom }
  }).filter((d) => d.shifts > 0)

  const byVehicle = vehicles.map((v) => {
    const vs = shiftsInRange.filter((s) => s.vehicleId === v.id)
    const ts = vs.flatMap((s) => s.trips).filter((t) => t.status === 'complete')
    const totalP = ts.reduce((sum, t) => sum + (t.paxToAirport || 0) + (t.paxFromAirport || 0), 0)
    const insp = inspections.filter((i) => i.vehicleId === v.id && inRange(i.date))
    const failed = insp.reduce((sum, i) => sum + Object.values(i.results).filter((x) => x === 'fail').length, 0)
    return { busNum: v.busNum, trips: ts.length, totalPax: totalP, inspections: insp.length, failedItems: failed }
  }).filter((v) => v.trips > 0 || v.inspections > 0)

  // approximate distance: 8km round trip per completed trip
  const totalKm = allTrips.length * 8

  return {
    kpis: {
      totalTrips: allTrips.length,
      totalPax,
      avgTripsPerDay: Math.round((allTrips.length / days) * 10) / 10,
      totalKm,
    },
    byDriver,
    byVehicle,
  }
}
