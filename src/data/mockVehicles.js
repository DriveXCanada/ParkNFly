/**
 * MOCK DATA — ShuttleLog Halifax
 * Data store: Railway Postgres
 * Table: Vehicles
 * Replace this file with: useFetchVehicles() hook → the backend API
 *
 * BACKEND: Replace with → GET /Vehicles table
 * Fields: Vehicle_ID, Bus_Number, Make, Model, Year, Capacity,
 *         Status, Odometer, Last_Inspection_Date, Inspection_Result,
 *         Next_Service_Due, Maintenance_Notes
 */

export const mockVehicles = [
  {
    id: 'V001',
    locationId: 'LOC-HFX',
    busNum: 'Bus 1',
    make: 'StarTrans',
    model: 'Senator II',
    year: 2021,
    capacity: 17,
    status: 'active',
    odometer: 87432,
    lastInspection: '2026-06-17',
    inspectionResult: 'pass',
    nextServiceDue: '2026-07-12',
    maintenanceNotes: 'Routine service completed on schedule. No outstanding items.',
  },
  {
    id: 'V002',
    locationId: 'LOC-HFX',
    busNum: 'Bus 2',
    make: 'StarTrans',
    model: 'Senator II',
    year: 2021,
    capacity: 17,
    status: 'active',
    odometer: 92105,
    lastInspection: '2026-06-18',
    inspectionResult: 'pass',
    nextServiceDue: '2026-07-02',
    maintenanceNotes: 'Front wiper blades replaced 2026-06-10.',
  },
  {
    id: 'V003',
    locationId: 'LOC-HFX',
    busNum: 'Bus 3',
    make: 'Ford',
    model: 'Transit 350',
    year: 2019,
    capacity: 12,
    status: 'flagged',
    odometer: 134789,
    lastInspection: '2026-06-16',
    inspectionResult: 'fail',
    nextServiceDue: '2026-06-20',
    maintenanceNotes: 'Driver-side mirror cracked and rear brake light intermittent. Awaiting parts.',
  },
  {
    id: 'V004',
    locationId: 'LOC-HFX',
    busNum: 'Bus 4',
    make: 'Ford',
    model: 'Transit 350',
    year: 2020,
    capacity: 12,
    status: 'idle',
    odometer: 108234,
    lastInspection: '2026-06-15',
    inspectionResult: 'pass',
    nextServiceDue: '2026-07-28',
    maintenanceNotes: 'Available — not currently assigned to a shift.',
  },
]

export const getVehicleById = (id) => mockVehicles.find((v) => v.id === id)
export const getVehicleLabel = (id) => getVehicleById(id)?.busNum ?? 'Unknown Vehicle'

export default mockVehicles
