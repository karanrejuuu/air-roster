import { createClient } from '@supabase/supabase-js'
import { addDays, addHours, formatISO, set } from 'date-fns'
import process from 'node:process'
import { type Airport, type Database, type Flight, type LeaveRequest, type Profile, type RosterEntry, type WeatherCache } from './types'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  throw new Error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running seed.')
}

const supabase = createClient<Database>(url, key)

const airports: Airport[] = [
  { iata: 'DEL', name: 'Indira Gandhi International', city: 'New Delhi', lat: 28.5562, lng: 77.1, timezone: 'Asia/Kolkata' },
  { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj', city: 'Mumbai', lat: 19.0896, lng: 72.8656, timezone: 'Asia/Kolkata' },
  { iata: 'BLR', name: 'Kempegowda International', city: 'Bengaluru', lat: 13.1986, lng: 77.7066, timezone: 'Asia/Kolkata' },
  { iata: 'MAA', name: 'Chennai International', city: 'Chennai', lat: 12.9941, lng: 80.1709, timezone: 'Asia/Kolkata' },
  { iata: 'CCU', name: 'Netaji Subhas Chandra Bose', city: 'Kolkata', lat: 22.6547, lng: 88.4467, timezone: 'Asia/Kolkata' },
  { iata: 'HYD', name: 'Rajiv Gandhi International', city: 'Hyderabad', lat: 17.2403, lng: 78.4294, timezone: 'Asia/Kolkata' },
  { iata: 'COK', name: 'Cochin International', city: 'Kochi', lat: 9.9816, lng: 76.2999, timezone: 'Asia/Kolkata' },
  { iata: 'AMD', name: 'Sardar Vallabhbhai Patel', city: 'Ahmedabad', lat: 23.0772, lng: 72.6347, timezone: 'Asia/Kolkata' }
]

const crewSeed = [
  ['Arjun Varma', 'Captain', 'pilot', 'DEL', 42],
  ['Rahul Mehta', 'Captain', 'pilot', 'BOM', 73],
  ['Kavita Nair', 'Captain', 'pilot', 'BLR', 76],
  ['Suresh Pillai', 'Captain', 'pilot', 'DEL', 87],
  ['Priya Sharma', 'FO', 'pilot', 'DEL', 34],
  ['Divya Kumar', 'FO', 'pilot', 'BOM', 44],
  ['Aakash Joshi', 'FO', 'pilot', 'BLR', 51],
  ['Meena Rao', 'FO', 'pilot', 'DEL', 30],
  ['Nina Joshi', 'Purser', 'cabin', 'DEL', 22],
  ['Rajesh Nair', 'Purser', 'cabin', 'BOM', 71],
  ['Sara Mathew', 'Senior Cabin Crew', 'cabin', 'DEL', 38],
  ['Amit Patel', 'Senior Cabin Crew', 'cabin', 'BOM', 49],
  ['Rekha Singh', 'Senior Cabin Crew', 'cabin', 'BLR', 52],
  ['Tom George', 'Senior Cabin Crew', 'cabin', 'DEL', 28],
  ['Ravi Thomas', 'Cabin Crew', 'cabin', 'DEL', 36],
  ['Meera Kumar', 'Cabin Crew', 'cabin', 'BOM', 45],
  ['Asha Williams', 'Cabin Crew', 'cabin', 'BLR', 53],
  ['Dev Sharma', 'Cabin Crew', 'cabin', 'DEL', 31],
  ['Priya George', 'Cabin Crew', 'cabin', 'COK', 40],
  ['Sunita Das', 'Cabin Crew', 'cabin', 'CCU', 58]
] as const

const flightTemplates = [
  ['AI 101', 'DEL', 'BOM', 6, 0, 8, 10, 'B737', 1148],
  ['AI 201', 'BOM', 'DEL', 9, 30, 11, 40, 'B737', 1148],
  ['AI 301', 'DEL', 'BLR', 7, 15, 9, 30, 'A320', 1740],
  ['AI 401', 'BLR', 'DEL', 10, 45, 13, 0, 'A320', 1740],
  ['AI 501', 'DEL', 'MAA', 13, 0, 15, 30, 'B737', 1760],
  ['AI 601', 'MAA', 'DEL', 16, 45, 19, 15, 'B737', 1760],
  ['AI 701', 'DEL', 'CCU', 8, 0, 10, 20, 'A320', 1305],
  ['AI 801', 'DEL', 'HYD', 14, 30, 16, 45, 'A320', 1253]
] as const

const weather: WeatherCache[] = [
  { airport_iata: 'DEL', condition: 'clear', fetched_at: new Date().toISOString(), qnh_hpa: 1008, temp_c: 38, visibility_km: 10, wind_dir: 'N', wind_kt: 8 },
  { airport_iata: 'BOM', condition: 'partly-cloudy', fetched_at: new Date().toISOString(), qnh_hpa: 1006, temp_c: 31, visibility_km: 8, wind_dir: 'SW', wind_kt: 15 },
  { airport_iata: 'BLR', condition: 'overcast', fetched_at: new Date().toISOString(), qnh_hpa: 1012, temp_c: 26, visibility_km: 6, wind_dir: 'W', wind_kt: 10 },
  { airport_iata: 'MAA', condition: 'partly-cloudy', fetched_at: new Date().toISOString(), qnh_hpa: 1009, temp_c: 33, visibility_km: 10, wind_dir: 'SE', wind_kt: 12 },
  { airport_iata: 'CCU', condition: 'rain', fetched_at: new Date().toISOString(), qnh_hpa: 1004, temp_c: 34, visibility_km: 4, wind_dir: 'S', wind_kt: 18 },
  { airport_iata: 'HYD', condition: 'clear', fetched_at: new Date().toISOString(), qnh_hpa: 1010, temp_c: 36, visibility_km: 10, wind_dir: 'NE', wind_kt: 6 },
  { airport_iata: 'COK', condition: 'rain', fetched_at: new Date().toISOString(), qnh_hpa: 1003, temp_c: 28, visibility_km: 3, wind_dir: 'SW', wind_kt: 20 },
  { airport_iata: 'AMD', condition: 'clear', fetched_at: new Date().toISOString(), qnh_hpa: 1007, temp_c: 40, visibility_km: 10, wind_dir: 'NW', wind_kt: 5 }
]

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('')
}

function istDate(base: Date, hour: number, minute: number) {
  return set(base, { hours: hour - 5, milliseconds: 0, minutes: minute - 30, seconds: 0 })
}

async function upsertCrew() {
  const profiles: Profile[] = []
  for (const [index, [name, rank, crewType, base, hours]] of crewSeed.entries()) {
    const email = `${name.toLowerCase().replaceAll(' ', '.')}@airroster.local`
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password: 'AirRoster2026!'
    })
    if (error && !error.message.includes('already')) throw error
    const userId = data.user?.id ?? crypto.randomUUID()
    profiles.push({
      base_airport: base,
      created_at: new Date().toISOString(),
      crew_type: crewType,
      employee_id: `AR${(index + 1).toString().padStart(4, '0')}`,
      full_name: name,
      id: userId,
      initials: initials(name),
      leave_balance: 21 - (index % 8),
      monthly_hours_max: 90,
      monthly_hours_used: hours,
      rank,
      role: crewType === 'pilot' ? 'pilot' : 'cabin_crew'
    })
  }
  const { error } = await supabase.from('profiles').upsert(profiles)
  if (error) throw error
  return profiles
}

function buildFlights(start: Date): Flight[] {
  return Array.from({ length: 7 }).flatMap((_, day) => {
    const date = addDays(start, day)
    return flightTemplates.map(([id, from, to, depHour, depMinute, arrHour, arrMinute, type, distance]) => ({
      aircraft_reg: `VT-${type === 'B737' ? 'B' : 'A'}${day}${id.slice(-1)}R`,
      aircraft_type: type,
      arrival_utc: formatISO(istDate(date, arrHour, arrMinute)),
      created_at: new Date().toISOString(),
      cruising_alt: 'FL350',
      departure_utc: formatISO(istDate(date, depHour, depMinute)),
      distance_km: distance,
      from_airport: from,
      id: `${id}-${day + 1}`,
      required_cabin: 3,
      required_captains: 1,
      required_fos: 1,
      status: 'scheduled',
      to_airport: to
    }))
  })
}

async function main() {
  const today = set(new Date(), { hours: 0, milliseconds: 0, minutes: 0, seconds: 0 })
  const crew = await upsertCrew()
  const flights = buildFlights(today)
  const leave: LeaveRequest[] = [crew[2], crew[9], crew[17], crew[2], crew[14]].map((member, index) => ({
    created_at: new Date().toISOString(),
    crew_id: member.id,
    from_date: formatISO(addDays(today, index + 1), { representation: 'date' }),
    id: crypto.randomUUID(),
    leave_type: index === 1 ? 'sick' : 'annual',
    note: index === 1 ? 'Medical rest requested' : 'Personal travel',
    reviewed_by: null,
    status: 'pending',
    to_date: formatISO(addDays(today, index + 2), { representation: 'date' })
  }))

  const { error: airportError } = await supabase.from('airports').upsert(airports)
  if (airportError) throw airportError
  const { error: flightError } = await supabase.from('flights').upsert(flights)
  if (flightError) throw flightError
  const { error: weatherError } = await supabase.from('weather_cache').upsert(weather)
  if (weatherError) throw weatherError
  const { error: leaveError } = await supabase.from('leave_requests').upsert(leave)
  if (leaveError) throw leaveError

  const assignments = flights.slice(0, 12).flatMap((flight, index) => [
    { crew_id: crew[index % 8].id, flight_id: flight.id, role_on_flight: 'Captain' },
    { crew_id: crew[4 + (index % 4)].id, flight_id: flight.id, role_on_flight: 'FO' },
    { crew_id: crew[8 + (index % 12)].id, flight_id: flight.id, role_on_flight: 'Cabin' }
  ])
  const { error: assignError } = await supabase.from('flight_assignments').upsert(assignments)
  if (assignError) throw assignError

  const roster: Omit<RosterEntry, 'created_at' | 'id'>[] = assignments.map((assignment) => ({
    crew_id: assignment.crew_id,
    date: formatISO(today, { representation: 'date' }),
    entry_type: 'flight' as const,
    flight_id: assignment.flight_id
  }))
  roster.push({ crew_id: crew[13].id, date: formatISO(addHours(today, 24), { representation: 'date' }), entry_type: 'off', flight_id: null })
  const { error: rosterError } = await supabase.from('roster_entries').insert(roster)
  if (rosterError) throw rosterError
}

await main()
console.log('AirRoster seed complete.')
