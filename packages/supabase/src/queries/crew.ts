import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../client'
import { getDemoProfiles, shouldUseDemoData, updateDemoProfile } from '../demoData'
import { type FlightWithDetails, type Profile } from '../types'

export const crewKeys = {
  all: ['crew'] as const,
  detail: (id: string) => ['crew', id] as const
}

export function useCrew() {
  return useQuery({
    queryFn: async () => {
      if (shouldUseDemoData()) return getDemoProfiles()
      const { data, error } = await supabase.from('profiles').select('*').order('full_name')
      if (error) throw error
      return data ?? []
    },
    queryKey: crewKeys.all
  })
}

export function useCrewMember(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: async () => {
      if (shouldUseDemoData()) return getDemoProfiles().find((profile) => profile.id === id) ?? null
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id ?? '').single()
      if (error) throw error
      return data
    },
    queryKey: crewKeys.detail(id ?? 'none')
  })
}

export function useUpsertCrew() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (profile: Profile) => {
      if (shouldUseDemoData()) {
        updateDemoProfile(profile)
        return
      }
      const { error } = await supabase.from('profiles').upsert(profile)
      if (error) throw error
    },
    onMutate: async (profile) => {
      await qc.cancelQueries({ queryKey: crewKeys.all })
      qc.setQueryData<Profile[]>(crewKeys.all, (current) => {
        const rows = current ?? []
        const exists = rows.some((member) => member.id === profile.id)
        return exists
          ? rows.map((member) => member.id === profile.id ? profile : member)
          : [...rows, profile].sort((a, b) => a.full_name.localeCompare(b.full_name))
      })
      qc.setQueryData<Profile | null>(crewKeys.detail(profile.id), profile)
      qc.setQueriesData<FlightWithDetails[]>({ queryKey: ['flights'] }, (current) => current?.map((flight) => ({
        ...flight,
        assignments: flight.assignments.map((assignment) => assignment.crew_id === profile.id ? { ...assignment, crew: profile } : assignment)
      })))
    },
    onSuccess: () => {
      if (shouldUseDemoData()) return
      void qc.invalidateQueries({ queryKey: crewKeys.all })
      void qc.invalidateQueries({ queryKey: ['flights'] })
    }
  })
}
