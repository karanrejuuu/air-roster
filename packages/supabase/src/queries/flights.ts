import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../client'
import { addDemoFlight, getDemoFlights, removeDemoAssignment, shouldUseDemoData, upsertDemoAssignment } from '../demoData'
import { type FlightWithDetails } from '../types'

export const flightKeys = {
  all: ['flights'] as const,
  week: (weekStart: string) => ['flights', weekStart] as const
}

const flightSelect = `*, from:airports!from_airport(*), to:airports!to_airport(*),
  assignments:flight_assignments(*, crew:profiles(*))`

export function useFlights(weekStart: string) {
  return useQuery({
    queryFn: async () => {
      if (shouldUseDemoData()) return getDemoFlights()
      const { data, error } = await supabase
        .from('flights')
        .select(flightSelect)
        .gte('departure_utc', weekStart)
        .order('departure_utc')
      if (error) throw error
      return (data ?? []) as unknown as FlightWithDetails[]
    },
    queryKey: flightKeys.week(weekStart)
  })
}

function invalidateFlights(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: flightKeys.all })
}

export function useAssignCrew() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ crewId, flightId, role }: { crewId: string; flightId: string; role: string }) => {
      if (shouldUseDemoData()) {
        upsertDemoAssignment({ crewId, flightId, role })
        return
      }
      const { error } = await supabase
        .from('flight_assignments')
        .upsert({ crew_id: crewId, flight_id: flightId, role_on_flight: role })
      if (error) throw error
    },
    onSuccess: () => invalidateFlights(qc)
  })
}

export function useRemoveAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      if (shouldUseDemoData()) {
        removeDemoAssignment(assignmentId)
        return
      }
      const { error } = await supabase.from('flight_assignments').delete().eq('id', assignmentId)
      if (error) throw error
    },
    onSuccess: () => invalidateFlights(qc)
  })
}

export function useAddFlight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (flight: Omit<FlightWithDetails, 'assignments' | 'from' | 'to' | 'created_at'>) => {
      if (shouldUseDemoData()) {
        addDemoFlight(flight)
        return
      }
      const { error } = await supabase.from('flights').insert(flight)
      if (error) throw error
    },
    onSuccess: () => invalidateFlights(qc)
  })
}
