/**
 * MOCK DATA — ShuttleLog Halifax
 * Data store: Railway Postgres
 * Table: Inspection_Checklist_Items
 * Replace this file with: useFetchChecklist() hook → the backend API
 *
 * BACKEND: Replace with → GET /Inspection_Checklist_Items table
 * Fields: Item_Key, Label, Category, Active, Critical
 *
 * The checklist is the canonical definition of every inspectable item.
 * Driver inspection screen, settings checklist manager, and PDF reports
 * all derive from this single source.
 *
 * `critical: true` marks an "unsafe" item — failing it automatically pulls
 * the vehicle out of service. Managers can adjust which items are critical
 * in Settings (stored in useManagerStore as `criticalItems`).
 */

export const inspectionGroups = [
  {
    key: 'exterior',
    label: 'Exterior',
    icon: '🚗',
    items: [
      { key: 'ext_headlights', label: 'Headlights & high beams', critical: true },
      { key: 'ext_taillights', label: 'Tail lights & brake lights', critical: true },
      { key: 'ext_turnsignals', label: 'Turn signals & hazards', critical: true },
      { key: 'ext_tires_front', label: 'Front tires & pressure', critical: true },
      { key: 'ext_tires_rear', label: 'Rear tires & pressure', critical: true },
      { key: 'ext_wipers', label: 'Wiper blades' },
      { key: 'ext_mirrors', label: 'Side & rear mirrors', critical: true },
      { key: 'ext_body', label: 'Body & panels (damage)' },
      { key: 'ext_doors', label: 'Passenger doors operation', critical: true },
      { key: 'ext_license', label: 'License plate & lighting' },
    ],
  },
  {
    key: 'interior',
    label: 'Interior & Safety',
    icon: '🪑',
    items: [
      { key: 'int_horn', label: 'Horn' },
      { key: 'int_seatbelts', label: 'Seatbelts', critical: true },
      { key: 'int_seats', label: 'Seats & securement' },
      { key: 'int_step', label: 'Entry step & handrail' },
      { key: 'int_floors', label: 'Floors & aisle clear' },
      { key: 'int_lights', label: 'Interior lights' },
      { key: 'int_hvac', label: 'Heating / AC (HVAC)' },
      { key: 'int_farebox', label: 'Fare box / luggage rack' },
    ],
  },
  {
    key: 'mechanical',
    label: 'Mechanical & Fluids',
    icon: '⚙️',
    items: [
      { key: 'mech_oil', label: 'Engine oil level' },
      { key: 'mech_coolant', label: 'Coolant level' },
      { key: 'mech_washer', label: 'Washer fluid level' },
      { key: 'mech_brakes', label: 'Service brakes', critical: true },
      { key: 'mech_steering', label: 'Steering response', critical: true },
      { key: 'mech_parkingbrake', label: 'Parking brake', critical: true },
    ],
  },
  {
    key: 'emergency',
    label: 'Emergency Equipment',
    icon: '🆘',
    items: [
      { key: 'emg_firstaid', label: 'First aid kit' },
      { key: 'emg_extinguisher', label: 'Fire extinguisher', critical: true },
      { key: 'emg_exits', label: 'Emergency exits', critical: true },
      { key: 'emg_contacts', label: 'Emergency contact list' },
    ],
  },
]

// Default set of "unsafe" item keys that trigger an automatic out-of-service.
export const defaultCriticalItems = inspectionGroups
  .flatMap((g) => g.items)
  .filter((i) => i.critical)
  .map((i) => i.key)

// Flattened list of every item with its category, used by reports & settings.
export const allInspectionItems = inspectionGroups.flatMap((group) =>
  group.items.map((item) => ({ ...item, category: group.label, groupKey: group.key })),
)

export const fuelLevels = ['Full', '3/4', '1/2', '1/4', 'Low']

export const getItemLabel = (key) =>
  allInspectionItems.find((i) => i.key === key)?.label ?? key

export default inspectionGroups
