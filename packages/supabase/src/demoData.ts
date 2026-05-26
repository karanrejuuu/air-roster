import { addDays, formatISO, set } from 'date-fns'
import { type Airport, type Flight, type FlightAssignment, type FlightWithDetails, type LeaveRequest, type LeaveWithCrew, type Profile, type RosterWithFlight, type WeatherCache } from './types'

export type DemoRoleKey = 'admin' | 'dispatcher' | 'pilot' | 'cabin_crew'

export const demoCredentials: Record<string, { password: string; role: DemoRoleKey }> = {
  'admin@airroster.local': { password: 'AirRoster2026!', role: 'admin' },
  'dispatcher@airroster.local': { password: 'AirRoster2026!', role: 'dispatcher' },
  'arjun.varma@airroster.local': { password: 'AirRoster2026!', role: 'pilot' },
  'nina.joshi@airroster.local': { password: 'AirRoster2026!', role: 'cabin_crew' }
}

const today = set(new Date(), { hours: 0, milliseconds: 0, minutes: 0, seconds: 0 })

export const demoAirports: Airport[] = [
  { iata: 'DEL', name: 'Indira Gandhi International', city: 'New Delhi', lat: 28.5562, lng: 77.1, timezone: 'Asia/Kolkata' },
  { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj', city: 'Mumbai', lat: 19.0896, lng: 72.8656, timezone: 'Asia/Kolkata' },
  { iata: 'BLR', name: 'Kempegowda International', city: 'Bengaluru', lat: 13.1986, lng: 77.7066, timezone: 'Asia/Kolkata' },
  { iata: 'MAA', name: 'Chennai International', city: 'Chennai', lat: 12.9941, lng: 80.1709, timezone: 'Asia/Kolkata' },
  { iata: 'CCU', name: 'Netaji Subhas Chandra Bose', city: 'Kolkata', lat: 22.6547, lng: 88.4467, timezone: 'Asia/Kolkata' },
  { iata: 'HYD', name: 'Rajiv Gandhi International', city: 'Hyderabad', lat: 17.2403, lng: 78.4294, timezone: 'Asia/Kolkata' }
]

const crewRows = [
  ['demo-admin', 'Asha Menon', 'AM', 'admin', null, null, 'DEL', 24],
  ['demo-dispatcher', 'Kabir Sethi', 'KS', 'dispatcher', null, null, 'DEL', 31],
  ['demo-arjun', 'Arjun Varma', 'AV', 'pilot', 'pilot', 'Captain', 'DEL', 42],
  ['demo-rahul', 'Rahul Mehta', 'RM', 'pilot', 'pilot', 'Captain', 'BOM', 73],
  ['demo-kavita', 'Kavita Nair', 'KN', 'pilot', 'pilot', 'Captain', 'BLR', 86],
  ['demo-priya', 'Priya Sharma', 'PS', 'pilot', 'pilot', 'FO', 'DEL', 34],
  ['demo-divya', 'Divya Kumar', 'DK', 'pilot', 'pilot', 'FO', 'BOM', 51],
  ['demo-nina', 'Nina Joshi', 'NJ', 'cabin_crew', 'cabin', 'Purser', 'DEL', 22],
  ['demo-sara', 'Sara Mathew', 'SM', 'cabin_crew', 'cabin', 'Senior Cabin Crew', 'DEL', 38],
  ['demo-amit', 'Amit Patel', 'AP', 'cabin_crew', 'cabin', 'Senior Cabin Crew', 'BOM', 49],
  ['demo-rekha', 'Rekha Singh', 'RS', 'cabin_crew', 'cabin', 'Senior Cabin Crew', 'BLR', 52],
  ['demo-ravi', 'Ravi Thomas', 'RT', 'cabin_crew', 'cabin', 'Cabin Crew', 'DEL', 36]
] as const

export const demoProfiles: Profile[] = crewRows.map(([id, fullName, initials, role, crewType, rank, base, hours], index) => ({
  base_airport: base,
  created_at: new Date().toISOString(),
  crew_type: crewType,
  employee_id: `DEMO${(index + 1).toString().padStart(3, '0')}`,
  full_name: fullName,
  id,
  initials,
  leave_balance: 21 - (index % 6),
  monthly_hours_max: 90,
  monthly_hours_used: hours,
  rank,
  role
}))

const demoProfilesStorageKey = 'airroster-demo-profiles'

export function getDemoProfiles(): Profile[] {
  if (typeof window === 'undefined') return demoProfiles
  const stored = window.localStorage?.getItem(demoProfilesStorageKey)
  if (!stored) return demoProfiles
  try {
    const parsed = JSON.parse(stored) as Profile[]
    return parsed.length ? parsed : demoProfiles
  } catch {
    return demoProfiles
  }
}

export function updateDemoProfile(profile: Profile) {
  if (typeof window === 'undefined') return
  const nextProfiles = getDemoProfiles().map((member) => member.id === profile.id ? profile : member)
  window.localStorage?.setItem(demoProfilesStorageKey, JSON.stringify(nextProfiles))
}

export function demoProfileForRole(role: DemoRoleKey) {
  const profile = getDemoProfiles().find((item) => item.role === role)
  if (!profile) throw new Error(`No demo profile for ${role}`)
  return profile
}

function airport(code: string) {
  return demoAirports.find((item) => item.iata === code) ?? null
}

function ist(day: number, hour: number, minute: number) {
  return set(addDays(today, day), { hours: hour - 5, milliseconds: 0, minutes: minute - 30, seconds: 0 }).toISOString()
}

const flightRows = [
  ['AI 101', 'DEL', 'BOM', 0, 6, 0, 8, 10, 'B737', 'VT-ARB', 1148],
  ['AI 301', 'DEL', 'BLR', 0, 7, 15, 9, 30, 'A320', 'VT-ARA', 1740],
  ['AI 701', 'DEL', 'CCU', 0, 8, 0, 10, 20, 'A320', 'VT-ARC', 1305],
  ['AI 501', 'DEL', 'MAA', 0, 13, 0, 15, 30, 'B737', 'VT-ARD', 1760],
  ['AI 801', 'DEL', 'HYD', 0, 14, 30, 16, 45, 'A320', 'VT-ARE', 1253],
  ['AI 201', 'BOM', 'DEL', 1, 9, 30, 11, 40, 'B737', 'VT-ARF', 1148],
  ['AI 401', 'BLR', 'DEL', 1, 10, 45, 13, 0, 'A320', 'VT-ARG', 1740]
] as const

const assignmentPlan = [
  ['demo-arjun', 'Captain'],
  ['demo-priya', 'FO'],
  ['demo-nina', 'Cabin'],
  ['demo-sara', 'Cabin'],
  ['demo-ravi', 'Cabin']
] as const

const demoFlightsStorageKey = 'airroster-demo-flights'
const demoAssignmentsStorageKey = 'airroster-demo-assignments'

function baseDemoFlights(): Flight[] {
  return flightRows.map(([id, from, to, day, depHour, depMinute, arrHour, arrMinute, type, reg, distance]) => ({
    aircraft_reg: reg,
    aircraft_type: type,
    arrival_utc: ist(day, arrHour, arrMinute),
    created_at: new Date().toISOString(),
    cruising_alt: 'FL350',
    departure_utc: ist(day, depHour, depMinute),
    distance_km: distance,
    from_airport: from,
    id,
    required_cabin: 3,
    required_captains: 1,
    required_fos: 1,
    status: 'scheduled',
    to_airport: to
  }))
}

function baseDemoAssignments(): FlightAssignment[] {
  return flightRows.slice(0, 3).flatMap(([flightId]) => assignmentPlan.map(([crewId, role]) => ({
    created_at: new Date().toISOString(),
    crew_id: crewId,
    flight_id: flightId,
    id: `${flightId}:${crewId}`,
    role_on_flight: role
  })))
}

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const stored = window.localStorage?.getItem(key)
  if (!stored) return fallback
  try {
    return JSON.parse(stored) as T
  } catch {
    return fallback
  }
}

function writeStored<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  window.localStorage?.setItem(key, JSON.stringify(value))
}

export function getDemoFlightBases(): Flight[] {
  return readStored(demoFlightsStorageKey, baseDemoFlights())
}

export function getDemoAssignments(): FlightAssignment[] {
  return readStored(demoAssignmentsStorageKey, baseDemoAssignments())
}

export function addDemoFlight(flight: Omit<FlightWithDetails, 'assignments' | 'from' | 'to' | 'created_at'>) {
  const nextFlight: Flight = {
    ...flight,
    created_at: new Date().toISOString()
  }
  const nextFlights = [...getDemoFlightBases().filter((item) => item.id !== nextFlight.id), nextFlight]
    .sort((a, b) => new Date(a.departure_utc).getTime() - new Date(b.departure_utc).getTime())
  writeStored(demoFlightsStorageKey, nextFlights)
}

export function upsertDemoAssignment({ crewId, flightId, role }: { crewId: string; flightId: string; role: string }) {
  const nextAssignment: FlightAssignment = {
    created_at: new Date().toISOString(),
    crew_id: crewId,
    flight_id: flightId,
    id: `${flightId}:${crewId}`,
    role_on_flight: role
  }
  const nextAssignments = [
    ...getDemoAssignments().filter((assignment) => !(assignment.flight_id === flightId && assignment.crew_id === crewId)),
    nextAssignment
  ]
  writeStored(demoAssignmentsStorageKey, nextAssignments)
}

export function removeDemoAssignment(assignmentId: string) {
  const nextAssignments = getDemoAssignments().filter((assignment) => assignment.id !== assignmentId)
  writeStored(demoAssignmentsStorageKey, nextAssignments)
}

export function getDemoFlights(): FlightWithDetails[] {
  const profiles = getDemoProfiles()
  const assignments = getDemoAssignments()
  return getDemoFlightBases().map((flight) => ({
    ...flight,
    assignments: assignments
      .filter((assignment) => assignment.flight_id === flight.id)
      .map((assignment) => ({
        ...assignment,
        crew: profiles.find((profile) => profile.id === assignment.crew_id) ?? null
      })),
    from: flight.from_airport ? airport(flight.from_airport) : null,
    to: flight.to_airport ? airport(flight.to_airport) : null
  }))
}

export const demoLeave: LeaveRequest[] = [
  {
    created_at: new Date().toISOString(),
    crew_id: 'demo-kavita',
    from_date: formatISO(addDays(today, 2), { representation: 'date' }),
    id: 'leave-1',
    leave_type: 'annual',
    note: 'Family travel',
    reviewed_by: null,
    status: 'pending',
    to_date: formatISO(addDays(today, 4), { representation: 'date' })
  },
  {
    created_at: new Date().toISOString(),
    crew_id: 'demo-amit',
    from_date: formatISO(addDays(today, 1), { representation: 'date' }),
    id: 'leave-2',
    leave_type: 'sick',
    note: 'Medical rest',
    reviewed_by: null,
    status: 'pending',
    to_date: formatISO(addDays(today, 2), { representation: 'date' })
  }
]

export function getDemoLeaveWithCrew(): LeaveWithCrew[] {
  const profiles = getDemoProfiles()
  return demoLeave.map((request) => ({
    ...request,
    crew: profiles.find((profile) => profile.id === request.crew_id) ?? null
  }))
}

export const demoWeather: WeatherCache[] = [
  { airport_iata: 'DEL', condition: 'clear', fetched_at: new Date().toISOString(), qnh_hpa: 1008, temp_c: 38, visibility_km: 10, wind_dir: 'N', wind_kt: 8 },
  { airport_iata: 'BOM', condition: 'partly-cloudy', fetched_at: new Date().toISOString(), qnh_hpa: 1006, temp_c: 31, visibility_km: 8, wind_dir: 'SW', wind_kt: 15 },
  { airport_iata: 'BLR', condition: 'overcast', fetched_at: new Date().toISOString(), qnh_hpa: 1012, temp_c: 26, visibility_km: 6, wind_dir: 'W', wind_kt: 10 },
  { airport_iata: 'MAA', condition: 'partly-cloudy', fetched_at: new Date().toISOString(), qnh_hpa: 1009, temp_c: 33, visibility_km: 10, wind_dir: 'SE', wind_kt: 12 },
  { airport_iata: 'CCU', condition: 'rain', fetched_at: new Date().toISOString(), qnh_hpa: 1004, temp_c: 34, visibility_km: 4, wind_dir: 'S', wind_kt: 18 },
  { airport_iata: 'HYD', condition: 'clear', fetched_at: new Date().toISOString(), qnh_hpa: 1010, temp_c: 36, visibility_km: 10, wind_dir: 'NE', wind_kt: 6 }
]

export function demoRosterFor(crewId: string, weekStart: string): RosterWithFlight[] {
  return getDemoFlights()
    .filter((flight) => flight.assignments.some((assignment) => assignment.crew_id === crewId))
    .map((flight) => ({
      created_at: new Date().toISOString(),
      crew_id: crewId,
      date: formatISO(parseFlightDate(flight.departure_utc), { representation: 'date' }),
      entry_type: 'flight',
      flight,
      flight_id: flight.id,
      id: `${crewId}-${flight.id}-${weekStart}`
    }))
}

function parseFlightDate(value: string) {
  return new Date(value)
}

export function demoModeRequested() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('demo') || Boolean(window.localStorage?.getItem('airroster-demo-role'))
}

export function shouldUseDemoData() {
  const missingEnv = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://example.supabase.co' || !import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY === 'missing-anon-key'
  return missingEnv || demoModeRequested()
}
