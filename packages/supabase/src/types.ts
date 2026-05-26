export type UserRole = 'admin' | 'dispatcher' | 'pilot' | 'cabin_crew'
export type CrewType = 'pilot' | 'cabin'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'
export type LeaveType = 'annual' | 'sick' | 'training'
export type RosterEntryType = 'flight' | 'leave' | 'rest' | 'training' | 'off'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Airport = {
  city: string
  iata: string
  lat: number
  lng: number
  name: string
  timezone: string
}

export type Profile = {
  base_airport: string | null
  created_at: string
  crew_type: CrewType | null
  employee_id: string
  full_name: string
  id: string
  initials: string
  leave_balance: number
  monthly_hours_max: number
  monthly_hours_used: number
  rank: string | null
  role: UserRole
}

export type Flight = {
  aircraft_reg: string | null
  aircraft_type: string | null
  arrival_utc: string
  created_at: string
  cruising_alt: string | null
  departure_utc: string
  distance_km: number | null
  from_airport: string | null
  id: string
  required_cabin: number
  required_captains: number
  required_fos: number
  status: string | null
  to_airport: string | null
}

export type FlightAssignment = {
  created_at: string
  crew_id: string
  flight_id: string
  id: string
  role_on_flight: string
}

export type RosterEntry = {
  created_at: string
  crew_id: string
  date: string
  entry_type: RosterEntryType
  flight_id: string | null
  id: string
}

export type LeaveRequest = {
  created_at: string
  crew_id: string
  from_date: string
  id: string
  leave_type: LeaveType
  note: string | null
  reviewed_by: string | null
  status: LeaveStatus
  to_date: string
}

export type WeatherCache = {
  airport_iata: string
  condition: string | null
  fetched_at: string
  qnh_hpa: number | null
  temp_c: number | null
  visibility_km: number | null
  wind_dir: string | null
  wind_kt: number | null
}

export type FlightWithDetails = Flight & {
  assignments: AssignmentWithCrew[]
  from: Airport | null
  to: Airport | null
}

export type AssignmentWithCrew = FlightAssignment & {
  crew: Profile | null
}

export type LeaveWithCrew = LeaveRequest & {
  crew: Profile | null
}

export type RosterWithFlight = RosterEntry & {
  flight: FlightWithDetails | null
}

export type Database = {
  public: {
    Tables: {
      airports: {
        Row: Airport
        Insert: Airport
        Update: Partial<Airport>
        Relationships: []
      }
      flight_assignments: {
        Row: FlightAssignment
        Insert: Partial<Pick<FlightAssignment, 'id' | 'created_at'>> & Pick<FlightAssignment, 'crew_id' | 'flight_id' | 'role_on_flight'>
        Update: Partial<FlightAssignment>
        Relationships: []
      }
      flights: {
        Row: Flight
        Insert: Partial<Pick<Flight, 'created_at' | 'cruising_alt' | 'required_cabin' | 'required_captains' | 'required_fos' | 'status'>> & Omit<Flight, 'created_at' | 'cruising_alt' | 'required_cabin' | 'required_captains' | 'required_fos' | 'status'>
        Update: Partial<Flight>
        Relationships: []
      }
      leave_requests: {
        Row: LeaveRequest
        Insert: Partial<Pick<LeaveRequest, 'id' | 'created_at' | 'reviewed_by' | 'status' | 'note'>> & Pick<LeaveRequest, 'crew_id' | 'from_date' | 'leave_type' | 'to_date'>
        Update: Partial<LeaveRequest>
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: Partial<Pick<Profile, 'created_at' | 'leave_balance' | 'monthly_hours_max' | 'monthly_hours_used'>> & Omit<Profile, 'created_at' | 'leave_balance' | 'monthly_hours_max' | 'monthly_hours_used'>
        Update: Partial<Profile>
        Relationships: []
      }
      roster_entries: {
        Row: RosterEntry
        Insert: Partial<Pick<RosterEntry, 'id' | 'created_at'>> & Omit<RosterEntry, 'id' | 'created_at'>
        Update: Partial<RosterEntry>
        Relationships: []
      }
      weather_cache: {
        Row: WeatherCache
        Insert: Partial<Pick<WeatherCache, 'fetched_at'>> & Omit<WeatherCache, 'fetched_at'>
        Update: Partial<WeatherCache>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_my_role: {
        Args: Record<string, never>
        Returns: UserRole
      }
    }
    Enums: {
      user_role: UserRole
    }
    CompositeTypes: Record<string, never>
  }
}
