import { differenceInHours, isBefore, isWithinInterval, parseISO } from 'date-fns'
import { type FlightWithDetails, type LeaveRequest, type Profile } from './types'

export type SlotType = 'captain' | 'first_officer' | 'cabin'

export type ConflictResult = {
  hasConflict: boolean
  message: string
  severity: 'block' | 'warn'
}

export type ConflictContext = {
  allAssignments: FlightWithDetails[]
  leaveRequests: LeaveRequest[]
}

const ok: ConflictResult = { hasConflict: false, message: 'OK', severity: 'warn' }

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd
}

export function checkRestPeriod(crew: Profile, flight: FlightWithDetails, allAssignments: FlightWithDetails[]): ConflictResult {
  const currentStart = parseISO(flight.departure_utc)
  const previousFlights = allAssignments
    .filter((candidate) => candidate.id !== flight.id)
    .filter((candidate) => candidate.assignments.some((assignment) => assignment.crew_id === crew.id))
    .filter((candidate) => isBefore(parseISO(candidate.arrival_utc), currentStart))
    .sort((a, b) => parseISO(b.arrival_utc).getTime() - parseISO(a.arrival_utc).getTime())

  const previous = previousFlights[0]
  if (!previous) return ok

  const restHours = differenceInHours(currentStart, parseISO(previous.arrival_utc))
  if (restHours < 10) {
    return {
      hasConflict: true,
      message: `${crew.full_name} has only ${restHours}h rest before ${flight.id}; DGCA minimum is 10h.`,
      severity: 'block'
    }
  }

  return ok
}

export function checkDutyLimit(crew: Profile, flight: FlightWithDetails): ConflictResult {
  const flightHours = Math.max(1, differenceInHours(parseISO(flight.arrival_utc), parseISO(flight.departure_utc)))
  const projected = crew.monthly_hours_used + flightHours
  if (projected > crew.monthly_hours_max) {
    return {
      hasConflict: true,
      message: `${crew.full_name} would exceed monthly duty limit (${projected}/${crew.monthly_hours_max}h).`,
      severity: 'block'
    }
  }
  if (projected / crew.monthly_hours_max >= 0.95) {
    return {
      hasConflict: true,
      message: `${crew.full_name} will be near monthly duty limit (${projected}/${crew.monthly_hours_max}h).`,
      severity: 'warn'
    }
  }
  return ok
}

export function checkDoubleBooking(crew: Profile, flight: FlightWithDetails, allAssignments: FlightWithDetails[]): ConflictResult {
  const start = parseISO(flight.departure_utc)
  const end = parseISO(flight.arrival_utc)
  const clash = allAssignments
    .filter((candidate) => candidate.id !== flight.id)
    .filter((candidate) => candidate.assignments.some((assignment) => assignment.crew_id === crew.id))
    .find((candidate) => overlaps(start, end, parseISO(candidate.departure_utc), parseISO(candidate.arrival_utc)))

  if (!clash) return ok
  return {
    hasConflict: true,
    message: `${crew.full_name} is already assigned to ${clash.id} during this window.`,
    severity: 'block'
  }
}

export function checkRankMatch(crew: Profile, slotType: SlotType): ConflictResult {
  const rank = crew.rank?.toLowerCase() ?? ''
  const pilot = crew.crew_type === 'pilot'
  const valid = (slotType === 'captain' && pilot && rank.includes('capt')) ||
    (slotType === 'first_officer' && pilot && (rank.includes('fo') || rank.includes('first'))) ||
    (slotType === 'cabin' && crew.crew_type === 'cabin')

  if (valid) return ok
  return {
    hasConflict: true,
    message: `${crew.full_name} cannot be assigned to ${slotType.replace('_', ' ')} slot.`,
    severity: 'block'
  }
}

export function checkLeaveConflict(crew: Profile, flight: FlightWithDetails, leaveRequests: LeaveRequest[]): ConflictResult {
  const departure = parseISO(flight.departure_utc)
  const leave = leaveRequests
    .filter((request) => request.crew_id === crew.id && request.status !== 'rejected')
    .find((request) => isWithinInterval(departure, {
      end: parseISO(`${request.to_date}T23:59:59Z`),
      start: parseISO(`${request.from_date}T00:00:00Z`)
    }))

  if (!leave) return ok
  return {
    hasConflict: true,
    message: `${crew.full_name} has ${leave.status} ${leave.leave_type} leave on this date.`,
    severity: 'warn'
  }
}

export function checkAllConflicts(
  crew: Profile,
  flight: FlightWithDetails,
  slot: SlotType,
  context: ConflictContext
): ConflictResult[] {
  return [
    checkRestPeriod(crew, flight, context.allAssignments),
    checkDutyLimit(crew, flight),
    checkDoubleBooking(crew, flight, context.allAssignments),
    checkRankMatch(crew, slot),
    checkLeaveConflict(crew, flight, context.leaveRequests)
  ].filter((result) => result.hasConflict)
}
