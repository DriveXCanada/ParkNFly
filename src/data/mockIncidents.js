/**
 * MOCK DATA — ShuttleLog
 * Data store: Railway Postgres
 * Table: Incidents
 * Replace this file with: useFetchIncidents() hook → the backend API
 *
 * BACKEND: Replace with → GET /Incidents table
 * Fields: Incident_ID, Date, Time, Driver_ID, Vehicle_ID, Location_ID,
 *         Type, Severity, Description, Status, Reported_By, Manager_Notes,
 *         Created_At
 *
 * Drivers file incident reports from the tablet; managers review and resolve
 * them from the dashboard.
 */

export const INCIDENT_TYPES = [
  'Vehicle collision',
  'Passenger injury',
  'Property damage',
  'Mechanical failure',
  'Near miss',
  'Weather / road hazard',
  'Passenger conduct',
  'Other',
]

export const INCIDENT_SEVERITY = ['Low', 'Medium', 'High', 'Critical']

export const INCIDENT_STATUS = {
  open: { label: 'Open', color: 'red' },
  reviewing: { label: 'Reviewing', color: 'amber' },
  resolved: { label: 'Resolved', color: 'green' },
}

export const mockIncidents = [
  {
    id: 'INC-1001',
    date: '2026-06-16',
    time: '2026-06-16T14:22:00',
    driverId: 'D003',
    vehicleId: 'V003',
    locationId: 'LOC-HFX',
    type: 'Property damage',
    severity: 'Medium',
    description:
      'Clipped a concrete bollard at the airport curb while pulling in. Minor scrape to driver-side mirror housing; mirror still functional but cracked.',
    status: 'reviewing',
    reportedBy: 'Terry Walsh',
    managerNotes: 'Mirror flagged on next inspection. Body shop quote requested.',
    createdAt: '2026-06-16T14:30:00',
  },
  {
    id: 'INC-1002',
    date: '2026-06-12',
    time: '2026-06-12T08:05:00',
    driverId: 'D002',
    vehicleId: 'V002',
    locationId: 'LOC-HFX',
    type: 'Near miss',
    severity: 'Low',
    description:
      'Vehicle ahead braked suddenly on Bell Rd. No contact. Two standing passengers, no injuries. Reminded passengers to hold rails.',
    status: 'resolved',
    reportedBy: 'Sandra LeBlanc',
    managerNotes: 'Reviewed with driver. No action required.',
    createdAt: '2026-06-12T08:20:00',
  },
]

export default mockIncidents
