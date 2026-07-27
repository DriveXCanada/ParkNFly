/**
 * MOCK DATA — ShuttleLog Halifax
 * Data store: Railway Postgres
 * Table: Drivers
 * Replace this file with: useFetchDrivers() hook → the backend API
 *
 * BACKEND: Replace with → GET /Drivers table
 * Fields: Driver_ID, Full_Name, Initials, Status, Employee_ID,
 *         Location_ID, Manager_Notes
 *
 * Drivers (staff) are scoped to a location. Managers add staff (name +
 * employee number) and can keep private Manager_Notes on each one.
 */

export const mockDrivers = [
  { id: 'D001', name: 'Mike Hennigar', initials: 'MH', status: 'active', employeeId: 'EMP-041', locationId: 'LOC-HFX', notes: '' },
  { id: 'D002', name: 'Sandra LeBlanc', initials: 'SL', status: 'active', employeeId: 'EMP-023', locationId: 'LOC-HFX', notes: '' },
  { id: 'D003', name: 'Terry Walsh', initials: 'TW', status: 'active', employeeId: 'EMP-067', locationId: 'LOC-HFX', notes: '' },
  { id: 'D004', name: 'Donna MacIsaac', initials: 'DM', status: 'active', employeeId: 'EMP-019', locationId: 'LOC-HFX', notes: '' },
  { id: 'D005', name: 'Roy Boutilier', initials: 'RB', status: 'active', employeeId: 'EMP-088', locationId: 'LOC-HFX', notes: '' },
  { id: 'D006', name: 'Janet Chisholm', initials: 'JC', status: 'on-leave', employeeId: 'EMP-034', locationId: 'LOC-HFX', notes: 'On parental leave until August 2026.' },
]

/** Build initials from a full name (for newly added staff). */
export const initialsFromName = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

export const getDriverById = (id) => mockDrivers.find((d) => d.id === id)
export const getDriverName = (id) => getDriverById(id)?.name ?? 'Unknown Driver'

export default mockDrivers
