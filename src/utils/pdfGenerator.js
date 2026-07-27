/**
 * pdfGenerator.js — jsPDF report generators for ShuttleLog.
 *
 * BACKEND: report payloads are assembled from the mock stores today. After
 * migration, the same builder functions receive records fetched from the backend
 * (Shifts, Trips, Inspections, Vehicles, Drivers) — only the data source
 * changes, the layout code stays identical.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { inspectionGroups, fuelLevels } from '../data/inspectionItems'
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatMinutes,
  minutesBetween,
} from './formatters'

// Drivex palette (RGB)
const GREEN = [232, 80, 10] // brand orange (accent) — name kept for minimal churn
const GREEN_DARK = [200, 67, 8]
const BRAND2 = [255, 107, 43]
const SUCCESS = [29, 158, 117]
const BLACK = [17, 17, 17]
const WHITE = [255, 255, 255]
const RED = [226, 75, 74]
const GRAY = [136, 136, 136]
const LIGHT = [253, 235, 228] // light orange tint

const PAGE = { w: 210, h: 297, margin: 14 }

// ---- Shared chrome --------------------------------------------------------

/** Draws the Drivex chevron mark at x,y within a `size` box. */
function drawLogoMark(doc, x, y, size) {
  const drawChevron = (ox, color, alpha) => {
    doc.setDrawColor(...color)
    doc.setLineWidth(size * 0.12)
    if (doc.setLineCap) doc.setLineCap('round')
    if (doc.setLineJoin) doc.setLineJoin('round')
    if (doc.saveGraphicsState && doc.GState) {
      doc.saveGraphicsState()
      doc.setGState(new doc.GState({ stroke: alpha }))
    }
    const x0 = x + ox
    doc.lines(
      [
        [size * 0.26, size * 0.24],
        [-size * 0.26, size * 0.24],
      ],
      x0,
      y + size * 0.26,
    )
    if (doc.restoreGraphicsState && doc.GState) doc.restoreGraphicsState()
  }
  drawChevron(size * 0.18, GREEN, 1)
  drawChevron(size * 0.42, BRAND2, 0.6)
  doc.setLineWidth(0.2)
}

/** Black header band + green accent strip. Returns y below the header. */
function drawHeader(doc, title, subtitle = "Halifax, NS · YHZ") {
  const headerH = 30
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, PAGE.w, headerH, 'F')

  drawLogoMark(doc, PAGE.margin, 7, 16)

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, PAGE.margin + 22, 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(200, 200, 200)
  doc.text(`Park'N Fly · ${subtitle}`, PAGE.margin + 22, 21)

  // generated timestamp (right aligned)
  doc.setFontSize(8)
  doc.setTextColor(180, 180, 180)
  doc.text(`Generated ${formatDateTime(new Date())}`, PAGE.w - PAGE.margin, 12, { align: 'right' })

  // green accent strip
  doc.setFillColor(...GREEN)
  doc.rect(0, headerH, PAGE.w, 3, 'F')

  return headerH + 11
}

/** Footer on every page: confidentiality + page numbers. */
function drawFooters(doc) {
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(220, 220, 218)
    doc.setLineWidth(0.3)
    doc.line(PAGE.margin, PAGE.h - 12, PAGE.w - PAGE.margin, PAGE.h - 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('Park\'N Fly Halifax — Confidential', PAGE.margin, PAGE.h - 7)
    doc.text(`Page ${i} of ${pages}`, PAGE.w - PAGE.margin, PAGE.h - 7, { align: 'right' })
    doc.setTextColor(...GREEN_DARK)
    doc.text('Drivex', PAGE.w / 2, PAGE.h - 7, { align: 'center' })
  }
}

/** Labelled info block (two-column grid of label/value pairs). */
function drawInfoBlock(doc, y, pairs, title) {
  if (title) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BLACK)
    doc.text(title, PAGE.margin, y)
    y += 5
  }
  const colW = (PAGE.w - PAGE.margin * 2) / 2
  const rowH = 7
  pairs.forEach((pair, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = PAGE.margin + col * colW
    const yy = y + row * rowH
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text(pair[0].toUpperCase(), x, yy)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...BLACK)
    doc.text(String(pair[1]), x + 38, yy)
  })
  const rows = Math.ceil(pairs.length / 2)
  return y + rows * rowH + 4
}

/** Row of green stat boxes. */
function drawStatBoxes(doc, y, stats) {
  const gap = 4
  const totalW = PAGE.w - PAGE.margin * 2
  const boxW = (totalW - gap * (stats.length - 1)) / stats.length
  const boxH = 20
  stats.forEach((s, i) => {
    const x = PAGE.margin + i * (boxW + gap)
    doc.setFillColor(...LIGHT)
    doc.roundedRect(x, y, boxW, boxH, 2.5, 2.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...GREEN_DARK)
    doc.text(String(s.value), x + boxW / 2, y + 9, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(s.label, x + boxW / 2, y + 15, { align: 'center' })
  })
  return y + boxH + 8
}

// ---- Helpers --------------------------------------------------------------

function tripTotals(trips) {
  const paxTo = trips.reduce((s, t) => s + (t.paxToAirport || 0), 0)
  const paxFrom = trips.reduce((s, t) => s + (t.paxFromAirport || 0), 0)
  return { paxTo, paxFrom, total: paxTo + paxFrom, count: trips.length }
}

// ===========================================================================
// 1. FULL SHIFT REPORT
// ===========================================================================
export function generateShiftReport({ shift, inspection, driver, vehicle }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = drawHeader(doc, 'DRIVER SHIFT REPORT')

  const trips = shift?.trips || []
  const totals = tripTotals(trips)
  const km = shift?.odoEnd != null && shift?.odoStart != null ? shift.odoEnd - shift.odoStart : null
  const dur = minutesBetween(shift?.startTime, shift?.endTime)

  y = drawInfoBlock(
    doc,
    y,
    [
      ['Driver', driver?.name || '—'],
      ['Vehicle', vehicle ? `${vehicle.busNum} (${vehicle.make} ${vehicle.model})` : '—'],
      ['Date', formatDate(shift?.date)],
      ['Shift Duration', dur ? formatMinutes(dur) : '—'],
      ['Odometer Start', shift?.odoStart != null ? `${shift.odoStart.toLocaleString()} km` : '—'],
      ['Odometer End', shift?.odoEnd != null ? `${shift.odoEnd.toLocaleString()} km` : '—'],
      ['Total Distance', km != null ? `${km.toLocaleString()} km` : '—'],
      ['Fuel Added', shift?.fuelLitres != null ? `${shift.fuelLitres} L` : '—'],
      ['Break Time', shift?.breakMinutes != null ? formatMinutes(shift.breakMinutes) : '—'],
      ['Active Time', shift?.activeMinutes != null ? formatMinutes(shift.activeMinutes) : '—'],
    ],
    'SHIFT SUMMARY',
  )

  y = drawStatBoxes(doc, y, [
    { value: totals.count, label: 'Total Trips' },
    { value: totals.paxTo, label: 'Pax to Airport' },
    { value: totals.paxFrom, label: 'Pax from Airport' },
    { value: totals.total, label: 'Total Passengers' },
  ])

  // Trip log table
  const body = trips.map((t) => [
    `#${t.tripNumber}`,
    formatTime(t.departLotTime),
    t.paxToAirport ?? 0,
    formatTime(t.arriveAirportTime),
    formatTime(t.departAirportTime),
    t.paxFromAirport ?? 0,
    formatTime(t.arriveLotTime),
    formatMinutes(minutesBetween(t.departLotTime, t.arriveLotTime)),
    (t.paxToAirport || 0) + (t.paxFromAirport || 0),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Trip', 'Left Lot', 'Pax→', 'At Airport', 'Left Airport', 'Pax←', 'At Lot', 'Duration', 'Total Pax']],
    body,
    foot: [[
      'TOTALS', '', totals.paxTo, '', '', totals.paxFrom, '', '', totals.total,
    ]],
    theme: 'striped',
    headStyles: { fillColor: BLACK, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: LIGHT, textColor: GREEN_DARK, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: BLACK },
    alternateRowStyles: { fillColor: [248, 248, 246] },
    margin: { left: PAGE.margin, right: PAGE.margin },
    columnStyles: {
      2: { halign: 'center' },
      5: { halign: 'center' },
      8: { halign: 'center', fontStyle: 'bold' },
    },
  })

  // Inspection summary
  if (inspection) {
    let iy = doc.lastAutoTable.finalY + 10
    if (iy > PAGE.h - 80) {
      doc.addPage()
      iy = drawHeader(doc, 'DRIVER SHIFT REPORT')
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BLACK)
    doc.text('PRE-TRIP INSPECTION', PAGE.margin, iy)
    iy += 4

    const inspBody = []
    inspectionGroups.forEach((group) => {
      group.items.forEach((item) => {
        const res = inspection.results?.[item.key]
        inspBody.push([group.label, item.label, (res || 'n/a').toUpperCase()])
      })
    })

    autoTable(doc, {
      startY: iy,
      head: [['Category', 'Item', 'Result']],
      body: inspBody,
      theme: 'grid',
      headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: PAGE.margin, right: PAGE.margin },
      columnStyles: { 2: { halign: 'center', cellWidth: 28, fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const v = data.cell.raw
          if (v === 'FAIL') {
            data.cell.styles.textColor = RED
          } else if (v === 'PASS') {
            data.cell.styles.textColor = SUCCESS
          }
        }
      },
    })

    let ny = doc.lastAutoTable.finalY + 8
    ny = drawNotesAndSignatures(doc, ny, inspection, true)
  }

  drawFooters(doc)
  doc.save(`ShiftReport_${driver?.name?.replace(/\s+/g, '') || 'Driver'}_${shift?.date || ''}.pdf`)
}

// Notes + dual signature lines. Returns new y.
function drawNotesAndSignatures(doc, y, inspection, withSupervisor) {
  if (y > PAGE.h - 50) {
    doc.addPage()
    y = drawHeader(doc, 'DRIVER SHIFT REPORT')
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BLACK)
  doc.text('Notes', PAGE.margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  const notes = inspection?.notes || 'No additional notes.'
  const lines = doc.splitTextToSize(notes, PAGE.w - PAGE.margin * 2)
  doc.text(lines, PAGE.margin, y)
  y += lines.length * 4.5 + 12

  // signature lines
  const colW = (PAGE.w - PAGE.margin * 2 - 10) / 2
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.3)
  doc.line(PAGE.margin, y, PAGE.margin + colW, y)
  if (withSupervisor) doc.line(PAGE.margin + colW + 10, y, PAGE.w - PAGE.margin, y)

  // typed signature above the line
  if (inspection?.signature) {
    doc.setFont('times', 'italic')
    doc.setFontSize(12)
    doc.setTextColor(...BLACK)
    doc.text(inspection.signature, PAGE.margin + 2, y - 2)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('Driver Signature', PAGE.margin, y + 5)
  if (withSupervisor) doc.text('Supervisor Signature', PAGE.margin + colW + 10, y + 5)
  return y + 12
}

// ===========================================================================
// 2. INSPECTION-ONLY REPORT
// ===========================================================================
export function generateInspectionReport({ inspection, driver, vehicle, shift }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = drawHeader(doc, 'VEHICLE INSPECTION REPORT')

  const overall = inspection?.overallResult || 'pass'
  y = drawInfoBlock(
    doc,
    y,
    [
      ['Vehicle', vehicle ? `${vehicle.busNum} (${vehicle.make} ${vehicle.model})` : '—'],
      ['Driver', driver?.name || '—'],
      ['Date', formatDate(inspection?.date)],
      ['Time', formatTime(inspection?.time)],
      ['Odometer', vehicle?.odometer != null ? `${vehicle.odometer.toLocaleString()} km` : '—'],
      ['Fuel Level', inspection?.fuelLevel || '—'],
      ['Overall Result', overall.toUpperCase()],
      ['Inspection ID', inspection?.id || '—'],
    ],
    'INSPECTION DETAILS',
  )

  // Failed items callout box
  const failed = inspection
    ? Object.entries(inspection.results || {})
        .filter(([, v]) => v === 'fail')
        .map(([k]) => k)
    : []

  if (failed.length > 0) {
    const labelMap = {}
    inspectionGroups.forEach((g) => g.items.forEach((i) => (labelMap[i.key] = i.label)))
    const boxH = 8 + failed.length * 5
    doc.setFillColor(253, 232, 234)
    doc.setDrawColor(...RED)
    doc.setLineWidth(0.4)
    doc.roundedRect(PAGE.margin, y, PAGE.w - PAGE.margin * 2, boxH, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...RED)
    doc.text(`⚠ ${failed.length} ISSUE(S) REQUIRING ATTENTION`, PAGE.margin + 4, y + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...BLACK)
    failed.forEach((k, i) => {
      doc.text(`• ${labelMap[k] || k}`, PAGE.margin + 6, y + 11 + i * 5)
    })
    y += boxH + 8
  }

  // Full grouped inspection table
  const body = []
  inspectionGroups.forEach((group) => {
    group.items.forEach((item, idx) => {
      const res = inspection?.results?.[item.key]
      body.push([idx === 0 ? group.label : '', item.label, (res || 'n/a').toUpperCase()])
    })
  })

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Item', 'Result']],
    body,
    theme: 'grid',
    headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    margin: { left: PAGE.margin, right: PAGE.margin },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 42 },
      2: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const v = data.cell.raw
        if (v === 'FAIL') data.cell.styles.textColor = RED
        else if (v === 'PASS') data.cell.styles.textColor = SUCCESS
      }
    },
  })

  let ny = doc.lastAutoTable.finalY + 8
  if (inspection?.photos?.length) {
    ny = drawPhotos(doc, ny, inspection.photos, 'INSPECTION PHOTOS', 'VEHICLE INSPECTION REPORT')
  }
  drawNotesAndSignatures(doc, ny, inspection, true)

  drawFooters(doc)
  doc.save(`Inspection_${vehicle?.busNum?.replace(/\s+/g, '') || 'Vehicle'}_${inspection?.date || ''}.pdf`)
}

// ===========================================================================
// 3. OPERATIONS SUMMARY REPORT
// ===========================================================================
export function generateOperationsSummary({ rangeLabel, kpis, byDriver, byVehicle, dailyRows }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = drawHeader(doc, 'OPERATIONS SUMMARY')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...GRAY)
  doc.text(`Reporting period: ${rangeLabel}`, PAGE.margin, y)
  y += 8

  y = drawStatBoxes(doc, y, [
    { value: kpis.totalTrips, label: 'Total Trips' },
    { value: kpis.totalPax, label: 'Total Passengers' },
    { value: kpis.avgTripsPerDay, label: 'Avg Trips / Day' },
    { value: kpis.totalKm + ' km', label: 'Distance' },
  ])

  // Per-driver breakdown
  autoTable(doc, {
    startY: y,
    head: [['Driver', 'Shifts', 'Trips', 'Pax→', 'Pax←', 'Total Pax']],
    body: byDriver.map((d) => [d.name, d.shifts, d.trips, d.paxTo, d.paxFrom, d.totalPax]),
    theme: 'striped',
    headStyles: { fillColor: BLACK, textColor: WHITE, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [248, 248, 246] },
    margin: { left: PAGE.margin, right: PAGE.margin },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 5: { halign: 'center', fontStyle: 'bold' } },
  })

  let vy = doc.lastAutoTable.finalY + 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BLACK)
  doc.text('Fleet Utilization', PAGE.margin, vy)
  vy += 3

  autoTable(doc, {
    startY: vy,
    head: [['Vehicle', 'Trips', 'Total Pax', 'Inspections', 'Failed Items']],
    body: byVehicle.map((v) => [v.busNum, v.trips, v.totalPax, v.inspections, v.failedItems]),
    theme: 'striped',
    headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [248, 248, 246] },
    margin: { left: PAGE.margin, right: PAGE.margin },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4 && Number(data.cell.raw) > 0) {
        data.cell.styles.textColor = RED
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  drawFooters(doc)
  doc.save(`OperationsSummary_${rangeLabel.replace(/[^\dA-Za-z]+/g, '_')}.pdf`)
}

// ===========================================================================
// 4. INCIDENT REPORT
// ===========================================================================
export function generateIncidentReport({ incident, driverName, vehicleName }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = drawHeader(doc, 'INCIDENT REPORT')

  // Severity banner
  const sevColor = incident.severity === 'Critical' || incident.severity === 'High' ? RED
    : incident.severity === 'Medium' ? [245, 166, 35] : GRAY
  doc.setFillColor(...sevColor)
  doc.roundedRect(PAGE.margin, y, PAGE.w - PAGE.margin * 2, 10, 2, 2, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`${incident.type}  ·  ${incident.severity} severity  ·  ${(incident.status || 'open').toUpperCase()}`, PAGE.w / 2, y + 6.5, { align: 'center' })
  y += 16

  y = drawInfoBlock(
    doc,
    y,
    [
      ['Reported By', incident.reportedBy || driverName || '—'],
      ['Vehicle', vehicleName || '—'],
      ['Date', formatDate(incident.date)],
      ['Time', formatTime(incident.time)],
      ['Incident ID', incident.id || '—'],
      ['Status', (incident.status || 'open').toUpperCase()],
    ],
    'INCIDENT DETAILS',
  )

  // Description
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...BLACK)
  doc.text('DESCRIPTION', PAGE.margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...BLACK)
  const descLines = doc.splitTextToSize(incident.description || '—', PAGE.w - PAGE.margin * 2)
  doc.text(descLines, PAGE.margin, y)
  y += descLines.length * 5 + 8

  // Manager notes
  if (incident.managerNotes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BLACK)
    doc.text('MANAGER NOTES', PAGE.margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...GRAY)
    const mLines = doc.splitTextToSize(incident.managerNotes, PAGE.w - PAGE.margin * 2)
    doc.text(mLines, PAGE.margin, y)
    y += mLines.length * 5 + 8
  }

  // Photos
  if (incident.photos?.length) {
    y = drawPhotos(doc, y, incident.photos, 'PHOTOS', 'INCIDENT REPORT')
  }

  // Signature lines
  if (y > PAGE.h - 40) {
    doc.addPage()
    y = drawHeader(doc, 'INCIDENT REPORT')
  } else {
    y = Math.max(y, PAGE.h - 50)
  }
  const colW = (PAGE.w - PAGE.margin * 2 - 10) / 2
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.3)
  doc.line(PAGE.margin, y, PAGE.margin + colW, y)
  doc.line(PAGE.margin + colW + 10, y, PAGE.w - PAGE.margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('Driver Signature', PAGE.margin, y + 5)
  doc.text('Supervisor Signature', PAGE.margin + colW + 10, y + 5)

  drawFooters(doc)
  doc.save(`Incident_${incident.id || 'report'}_${incident.date || ''}.pdf`)
}

/** Lay out attached photos in a 2-up grid; paginates as needed. */
function drawPhotos(doc, y, photos, title, headerTitle) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...BLACK)
  if (y > PAGE.h - 30) {
    doc.addPage()
    y = drawHeader(doc, headerTitle)
  }
  doc.text(`${title} (${photos.length})`, PAGE.margin, y)
  y += 5

  const gap = 6
  const cellW = (PAGE.w - PAGE.margin * 2 - gap) / 2
  const cellH = cellW * 0.7
  let col = 0
  photos.forEach((src) => {
    if (y + cellH > PAGE.h - 18) {
      doc.addPage()
      y = drawHeader(doc, headerTitle)
      col = 0
    }
    const x = PAGE.margin + col * (cellW + gap)
    try {
      doc.addImage(src, 'JPEG', x, y, cellW, cellH, undefined, 'FAST')
    } catch {
      doc.setDrawColor(...GRAY)
      doc.rect(x, y, cellW, cellH)
    }
    col++
    if (col === 2) {
      col = 0
      y += cellH + gap
    }
  })
  if (col === 1) y += cellH + gap
  return y + 4
}

export { fuelLevels }
