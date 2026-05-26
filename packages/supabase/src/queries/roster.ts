import { useQuery } from '@tanstack/react-query'
import { supabase } from '../client'
import { demoRosterFor, shouldUseDemoData } from '../demoData'
import { type RosterWithFlight } from '../types'

export const rosterKeys = {
  own: (crewId: string, weekStart: string) => ['roster', crewId, weekStart] as const
}

export function useOwnRoster(crewId: string | null, weekStart: string) {
  return useQuery({
    enabled: Boolean(crewId),
    queryFn: async () => {
      if (shouldUseDemoData()) return demoRosterFor(crewId ?? '', weekStart)
      const { data, error } = await supabase
        .from('roster_entries')
        .select('*, flight:flights(*, from:airports!from_airport(*), to:airports!to_airport(*), assignments:flight_assignments(*, crew:profiles(*)))')
        .eq('crew_id', crewId ?? '')
        .gte('date', weekStart)
        .order('date')
      if (error) throw error
      return (data ?? []) as unknown as RosterWithFlight[]
    },
    queryKey: rosterKeys.own(crewId ?? 'none', weekStart)
  })
}
