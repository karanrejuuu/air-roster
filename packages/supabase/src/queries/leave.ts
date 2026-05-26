import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../client'
import { demoLeave, getDemoLeaveWithCrew, shouldUseDemoData } from '../demoData'
import { type LeaveRequest, type LeaveStatus, type LeaveWithCrew } from '../types'

export const leaveKeys = {
  all: ['leave'] as const,
  own: (crewId: string) => ['leave', crewId] as const
}

export function useLeaveRequests() {
  return useQuery({
    queryFn: async () => {
      if (shouldUseDemoData()) return getDemoLeaveWithCrew()
      const { data, error } = await supabase.from('leave_requests').select('*, crew:profiles(*)').order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as LeaveWithCrew[]
    },
    queryKey: leaveKeys.all
  })
}

export function useOwnLeaveRequests(crewId: string | null) {
  return useQuery({
    enabled: Boolean(crewId),
    queryFn: async () => {
      if (shouldUseDemoData()) return demoLeave.filter((request) => request.crew_id === crewId)
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('crew_id', crewId ?? '')
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
    queryKey: leaveKeys.own(crewId ?? 'none')
  })
}

export function useSubmitLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (request: Pick<LeaveRequest, 'crew_id' | 'from_date' | 'leave_type' | 'note' | 'to_date'>) => {
      if (shouldUseDemoData()) return
      const { error } = await supabase.from('leave_requests').insert(request)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: leaveKeys.all })
      void qc.invalidateQueries({ queryKey: leaveKeys.own(variables.crew_id) })
    }
  })
}

export function useUpdateLeaveStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeaveStatus }) => {
      if (shouldUseDemoData()) return
      const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.all })
  })
}
