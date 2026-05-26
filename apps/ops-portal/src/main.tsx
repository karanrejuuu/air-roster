import * as Dialog from '@radix-ui/react-dialog'
import * as Popover from '@radix-ui/react-popover'
import * as Tooltip from '@radix-ui/react-tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  checkAllConflicts,
  demoAirports,
  type FlightWithDetails,
  type LeaveRequest,
  type Profile,
  type SlotType,
  useAuth,
  AuthProvider
} from '@supabase'
import { useAddFlight, useAssignCrew, useCrew, useFlights, useLeaveRequests, useRemoveAssignment, useUpdateLeaveStatus, useUpsertCrew } from '@supabase'
import { Avatar, Badge, Button, DutyBar, Input, Overline, StatusDot, ToastViewport, useToastStore } from '@ui/index'
import '@ui/styles.css'
import { addDays, addWeeks, differenceInHours, format, isSameDay, parseISO, startOfWeek } from 'date-fns'
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock, MoreHorizontal, Plane, Plus, Search, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Navigate, NavLink, Route, BrowserRouter as Router, Routes, useNavigate, useParams } from 'react-router-dom'
import { create } from 'zustand'
import styles from './styles.module.css'

const qc = new QueryClient()

declare global {
  interface Window {
    __airrosterOpsRoot?: Root
  }
}

type BoardMode = 'day' | 'week'
type CrewFilter = 'All' | 'Pilots' | 'Cabin' | 'Available' | 'On duty' | 'Leave'
type FlightInput = Omit<FlightWithDetails, 'assignments' | 'from' | 'to' | 'created_at'>
type FlightForm = {
  aircraft_reg: string
  aircraft_type: string
  arrival_utc: string
  departure_utc: string
  distance_km: string
  from_airport: string
  id: string
  required_cabin: string
  required_captains: string
  required_fos: string
  to_airport: string
}
type UiStore = {
  mode: BoardMode
  selectedDate: Date
  setMode: (mode: BoardMode) => void
  setSelectedDate: (date: Date) => void
}

const useUiStore = create<UiStore>((set) => ({
  mode: 'day',
  selectedDate: new Date(),
  setMode: (mode) => set({ mode }),
  setSelectedDate: (selectedDate) => set({ selectedDate })
}))

function datetimeValue(date: Date, hour: number, minute: number) {
  const value = new Date(date)
  value.setHours(hour, minute, 0, 0)
  return format(value, "yyyy-MM-dd'T'HH:mm")
}

function allowedOps(role: string | null) {
  return role === 'admin' || role === 'dispatcher'
}

function LoadingScreen() {
  return <div className={styles.centerState}>Loading AirRoster Ops</div>
}

function Protected({ adminOnly = false, children }: { adminOnly?: boolean; children: ReactNode }) {
  const { loading, profile, role } = useAuth()
  if (loading) return <LoadingScreen />
  if (!profile) return <Navigate to="/unauthorized" />
  if (adminOnly && role !== 'admin') return <Navigate to="/unauthorized" />
  if (!allowedOps(role)) return <Navigate to="/unauthorized" />
  return children
}

function Unauthorized() {
  return (
    <div className={styles.centerState}>
      <h1>Unauthorized</h1>
      <p>This portal is available to AirRoster operations roles only.</p>
    </div>
  )
}

function DemoBootstrap() {
  const { role } = useParams()
  useEffect(() => {
    if (role === 'admin' || role === 'dispatcher') {
      window.localStorage.setItem('airroster-demo-role', role)
      window.location.replace('/flights')
    } else {
      window.location.replace('/unauthorized')
    }
  }, [role])
  return <LoadingScreen />
}

function Layout({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth()
  const nav = [
    ['Dashboard', '/dashboard', true],
    ['Flight Board', '/flights', true],
    ['Crew', '/crew', role === 'admin'],
    ['Leave', '/leave', true],
    ['Settings', '/settings', role === 'admin']
  ] as const

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span>AirRoster</span>
          <small>OPS PORTAL</small>
        </div>
        <nav className={styles.sideNav}>
          {nav.filter((item) => item[2]).map(([label, path]) => (
            <NavLink className={({ isActive }) => isActive ? styles.activeNav : styles.navItem} key={path} to={path}>{label}</NavLink>
          ))}
        </nav>
        <button className={styles.userChip} onClick={() => void signOut()} type="button">
          <Avatar initials={profile?.initials ?? 'AR'} size="sm" />
          <span>{profile?.full_name ?? 'Operations'}</span>
          <small>{role ?? 'ops'}</small>
        </button>
      </aside>
      <main className={styles.main}>{children}</main>
      <div className={styles.desktopOnly}>AirRoster Ops is designed for desktop.</div>
      <ToastViewport />
    </div>
  )
}

function useOpsData() {
  const weekStart = format(startOfWeek(useUiStore((state) => state.selectedDate), { weekStartsOn: 1 }), "yyyy-MM-dd'T'00:00:00xxx")
  const flights = useFlights(weekStart)
  const crew = useCrew()
  const leave = useLeaveRequests()
  return { crew, flights, leave, weekStart }
}

function staffing(flight: FlightWithDetails) {
  const capt = flight.assignments.filter((assignment) => assignment.role_on_flight === 'Captain').length
  const fo = flight.assignments.filter((assignment) => assignment.role_on_flight === 'FO').length
  const cabin = flight.assignments.filter((assignment) => assignment.role_on_flight === 'Cabin').length
  const missing = Math.max(0, flight.required_captains - capt) + Math.max(0, flight.required_fos - fo) + Math.max(0, flight.required_cabin - cabin)
  return { cabin, capt, fo, missing }
}

function Dashboard() {
  const { crew, flights, leave } = useOpsData()
  const selectedDate = useUiStore((state) => state.selectedDate)
  const todaysFlights = (flights.data ?? []).filter((flight) => isSameDay(parseISO(flight.departure_utc), selectedDate))
  const openSlots = todaysFlights.reduce((sum, flight) => sum + staffing(flight).missing, 0)
  const crewOnDuty = new Set(todaysFlights.flatMap((flight) => flight.assignments.map((assignment) => assignment.crew_id))).size
  const pendingLeave = (leave.data ?? []).filter((request) => request.status === 'pending').length
  const alerts = (crew.data ?? []).filter((member) => member.monthly_hours_used / member.monthly_hours_max >= 0.75).sort((a, b) => (b.monthly_hours_used / b.monthly_hours_max) - (a.monthly_hours_used / a.monthly_hours_max))

  return (
    <Layout>
      <section className={styles.page}>
        <Header title="Dashboard" />
        <div className={styles.stats}>
          <Stat label="Crew on duty today" sub="Assigned to active flights" value={crewOnDuty} />
          <Stat label="Flights today" sub={format(selectedDate, 'dd MMM yyyy')} value={todaysFlights.length} />
          <Stat label="Open slots" sub="Unfilled required positions" value={openSlots} />
          <Stat label="Pending leave requests" sub="Awaiting ops review" value={pendingLeave} />
        </div>
        <div className={styles.dashboardGrid}>
          <Panel title="Today's Flights">
            <table className={styles.table}>
              <tbody>
                {todaysFlights.map((flight) => (
                  <tr key={flight.id}>
                    <td>{flight.id}</td>
                    <td>{flight.from_airport} → {flight.to_airport}</td>
                    <td>{format(parseISO(flight.departure_utc), 'HH:mm')}</td>
                    <td>{staffing(flight).missing === 0 ? 'Staffed' : `${staffing(flight).missing} open`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Duty Alerts">
            <div className={styles.alertList}>
              {alerts.map((member) => (
                <div className={styles.alertRow} key={member.id}>
                  <Avatar initials={member.initials} />
                  <div>
                    <strong>{member.full_name}</strong>
                    <DutyBar max={member.monthly_hours_max} used={member.monthly_hours_used} />
                  </div>
                  <span>{member.monthly_hours_max - member.monthly_hours_used} hrs remaining</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>
    </Layout>
  )
}

function Header({ title }: { title: string }) {
  return (
    <div className={styles.pageHeader}>
      <Overline>Airline operations</Overline>
      <h1>{title}</h1>
    </div>
  )
}

function Stat({ label, sub, value }: { label: string; sub: string; value: number }) {
  return (
    <article className={styles.statCard}>
      <Overline>{label}</Overline>
      <strong>{value}</strong>
      <span>{sub}</span>
    </article>
  )
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={styles.panel}>
      <Overline>{title}</Overline>
      {children}
    </section>
  )
}

function crewUnavailable(member: Profile, selectedDate: Date, flights: FlightWithDetails[], leave: LeaveRequest[]) {
  if (member.monthly_hours_used >= member.monthly_hours_max) return 'over limit'
  if (leave.some((request) => request.crew_id === member.id && request.status !== 'rejected' && selectedDate >= parseISO(`${request.from_date}T00:00:00Z`) && selectedDate <= parseISO(`${request.to_date}T23:59:59Z`))) return 'leave'
  if (flights.some((flight) => isSameDay(parseISO(flight.departure_utc), selectedDate) && flight.assignments.some((assignment) => assignment.crew_id === member.id))) return 'on duty'
  return null
}

function FlightBoard() {
  const { crew, flights, leave } = useOpsData()
  const selectedDate = useUiStore((state) => state.selectedDate)
  const setSelectedDate = useUiStore((state) => state.setSelectedDate)
  const mode = useUiStore((state) => state.mode)
  const setMode = useUiStore((state) => state.setMode)
  const [crewSearch, setCrewSearch] = useState('')
  const [filter, setFilter] = useState<CrewFilter>('Available')
  const [dragCrew, setDragCrew] = useState<Profile | null>(null)
  const [drawerFlight, setDrawerFlight] = useState<FlightWithDetails | null>(null)
  const [addFlightOpen, setAddFlightOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const searchRef = useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()
  const dayFlights = (flights.data ?? []).filter((flight) => isSameDay(parseISO(flight.departure_utc), selectedDate))
  const problemCount = dayFlights.filter((flight) => staffing(flight).missing > 0).length

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key.toLowerCase() === 'd') setMode('day')
      if (event.key.toLowerCase() === 'w') setMode('week')
      if (event.key === 'ArrowLeft') setSelectedDate(mode === 'day' ? addDays(selectedDate, -1) : addWeeks(selectedDate, -1))
      if (event.key === 'ArrowRight') setSelectedDate(mode === 'day' ? addDays(selectedDate, 1) : addWeeks(selectedDate, 1))
      if (event.key.toLowerCase() === 't') setSelectedDate(new Date())
      if (event.key === '?') navigate('/shortcuts')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, navigate, selectedDate, setMode, setSelectedDate])

  const sortedCrew = useMemo(() => {
    const allCrew = crew.data ?? []
    return allCrew
      .filter((member) => {
        const text = `${member.full_name} ${member.rank ?? ''} ${member.base_airport ?? ''}`.toLowerCase()
        const typeMatch = filter === 'All' || filter === 'Available' || filter === 'On duty' || filter === 'Leave' ||
          (filter === 'Pilots' && member.crew_type === 'pilot') ||
          (filter === 'Cabin' && member.crew_type === 'cabin')
        const state = crewUnavailable(member, selectedDate, flights.data ?? [], (leave.data ?? []).map((request) => ({ ...request, crew: undefined })).map((request) => request))
        const filterMatch = filter === 'All' ||
          (filter === 'Available' && state === null) ||
          (filter === 'On duty' && state === 'on duty') ||
          (filter === 'Leave' && state === 'leave') ||
          filter === 'Pilots' ||
          filter === 'Cabin'
        return text.includes(crewSearch.toLowerCase()) && typeMatch && filterMatch
      })
      .sort((a, b) => {
        const aUnavailable = crewUnavailable(a, selectedDate, flights.data ?? [], (leave.data ?? []).map((request) => ({ ...request, crew: undefined })).map((request) => request)) ? 1 : 0
        const bUnavailable = crewUnavailable(b, selectedDate, flights.data ?? [], (leave.data ?? []).map((request) => ({ ...request, crew: undefined })).map((request) => request)) ? 1 : 0
        return aUnavailable - bUnavailable || a.monthly_hours_used - b.monthly_hours_used
      })
  }, [crew.data, crewSearch, filter, flights.data, leave.data, selectedDate])

  if (flights.isLoading || crew.isLoading || leave.isLoading) return <Layout><LoadingScreen /></Layout>
  if (flights.isError || crew.isError || leave.isError) return <Layout><div className={styles.centerState}>Unable to load ops data. Check Supabase credentials and RLS.</div></Layout>

  return (
    <Layout>
      <div className={styles.boardShell}>
        <div className={styles.topBar}>
          <div className={styles.topLeft}>
            <div className={styles.segmented}>
              <button className={mode === 'day' ? styles.segActive : ''} onClick={() => setMode('day')} type="button">Day</button>
              <button className={mode === 'week' ? styles.segActive : ''} onClick={() => setMode('week')} type="button">Week</button>
            </div>
            <button onClick={() => setSelectedDate(mode === 'day' ? addDays(selectedDate, -1) : addWeeks(selectedDate, -1))} type="button"><ChevronLeft size={16} strokeWidth={1.5} /></button>
            <strong>{mode === 'day' ? format(selectedDate, 'EEE dd MMM yyyy') : `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd MMM')} - ${format(addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), 6), 'dd MMM yyyy')}`}</strong>
            <button onClick={() => setSelectedDate(mode === 'day' ? addDays(selectedDate, 1) : addWeeks(selectedDate, 1))} type="button"><ChevronRight size={16} strokeWidth={1.5} /></button>
          </div>
          <div className={styles.topRight}>
            <Badge variant={problemCount > 0 ? 'warn' : 'neutral'}>{problemCount} issues</Badge>
            <Button onClick={() => searchRef.current?.focus()} size="sm" variant="ghost"><Search size={16} strokeWidth={1.5} /> Search crew</Button>
            <Button onClick={() => setAddFlightOpen(true)} size="sm"><Plus size={16} strokeWidth={1.5} /> Add flight</Button>
          </div>
        </div>
        <div className={styles.boardContent}>
          <aside className={styles.crewPanel}>
            <Overline>Crew</Overline>
            <Input onChange={(event) => setCrewSearch(event.target.value)} placeholder="Filter by name, rank, base..." ref={searchRef} value={crewSearch} />
            <div className={styles.chips}>
              {(['All', 'Pilots', 'Cabin', 'Available', 'On duty', 'Leave'] as CrewFilter[]).map((chip) => (
                <button className={filter === chip ? styles.chipActive : ''} key={chip} onClick={() => setFilter(chip)} type="button">{chip}</button>
              ))}
            </div>
            <div className={styles.crewList}>
              {sortedCrew.map((member, index) => {
                const unavailable = crewUnavailable(member, selectedDate, flights.data ?? [], (leave.data ?? []).map((request) => ({ ...request, crew: undefined })).map((request) => request))
                const previous = index > 0 ? crewUnavailable(sortedCrew[index - 1], selectedDate, flights.data ?? [], (leave.data ?? []).map((request) => ({ ...request, crew: undefined })).map((request) => request)) : null
                return (
                  <div key={member.id}>
                    {unavailable && !previous ? <div className={styles.unavailableDivider}>Unavailable</div> : null}
                    <button
                      className={`${styles.crewCard} ${unavailable ? styles.unavailableCrew : ''}`}
                      draggable={!unavailable}
                      onDragEnd={() => setDragCrew(null)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'copy'
                        event.dataTransfer.setData('text/plain', member.id)
                        setDragCrew(member)
                      }}
                      type="button"
                    >
                      <Avatar initials={member.initials} />
                      <div>
                        <strong>{member.full_name}</strong>
                        <span>{member.rank} · {member.base_airport}</span>
                        <DutyBar max={member.monthly_hours_max} used={member.monthly_hours_used} />
                      </div>
                      <StatusDot color={unavailable === 'leave' ? 'gray' : unavailable === 'over limit' ? 'red' : unavailable === 'on duty' ? 'amber' : 'green'} />
                    </button>
                  </div>
                )
              })}
            </div>
          </aside>
          {mode === 'day' ? (
            <DayBoard
              collapsed={collapsed}
              context={{ allAssignments: flights.data ?? [], leaveRequests: (leave.data ?? []).map((request) => ({ ...request, crew: undefined })).map((request) => request) }}
              crewMembers={crew.data ?? []}
              dragCrew={dragCrew}
              flights={dayFlights}
              onDrawer={setDrawerFlight}
              onToggleGroup={(group) => setCollapsed((items) => items.includes(group) ? items.filter((item) => item !== group) : [...items, group])}
              selectedDate={selectedDate}
            />
          ) : (
            <WeekBoard flights={flights.data ?? []} onSelect={(date) => { setSelectedDate(date); setMode('day') }} selectedDate={selectedDate} />
          )}
        </div>
        <div className={styles.hintBar}>Press ? for shortcuts · / to search crew</div>
        <FlightDrawer flight={drawerFlight} onClose={() => setDrawerFlight(null)} />
        <AddFlightDialog onOpenChange={setAddFlightOpen} open={addFlightOpen} selectedDate={selectedDate} />
      </div>
    </Layout>
  )
}

function groupName(flight: FlightWithDetails) {
  const hour = parseISO(flight.departure_utc).getHours()
  if (hour < 12) return 'MORNING'
  if (hour < 18) return 'AFTERNOON'
  return 'EVENING'
}

function DayBoard({
  collapsed,
  context,
  crewMembers,
  dragCrew,
  flights,
  onDrawer,
  onToggleGroup
}: {
  collapsed: string[]
  context: { allAssignments: FlightWithDetails[]; leaveRequests: LeaveRequest[] }
  crewMembers: Profile[]
  dragCrew: Profile | null
  flights: FlightWithDetails[]
  onDrawer: (flight: FlightWithDetails) => void
  onToggleGroup: (group: string) => void
  selectedDate: Date
}) {
  const grouped = ['MORNING', 'AFTERNOON', 'EVENING'].map((group) => [group, flights.filter((flight) => groupName(flight) === group)] as const)
  return (
    <section className={styles.flightBoard}>
      <div className={styles.boardHeader}>
        <span>DEP</span><span>FLIGHT</span><span>ROUTE</span><span>AIRCRAFT</span><span>CAPT</span><span>FO</span><span>CABIN</span><span>STATUS</span>
      </div>
      {grouped.map(([group, items]) => (
        <div key={group}>
          <button className={styles.groupHeader} onClick={() => onToggleGroup(group)} type="button">
            {group} <span>{items.length} flights · {items.filter((flight) => staffing(flight).missing > 0).length} understaffed</span>
          </button>
          {collapsed.includes(group) ? null : items.map((flight) => (
            <FlightRow context={context} crewMembers={crewMembers} dragCrew={dragCrew} flight={flight} key={flight.id} onDrawer={onDrawer} />
          ))}
        </div>
      ))}
    </section>
  )
}

function FlightRow({
  context,
  crewMembers,
  dragCrew,
  flight,
  onDrawer
}: {
  context: { allAssignments: FlightWithDetails[]; leaveRequests: LeaveRequest[] }
  crewMembers: Profile[]
  dragCrew: Profile | null
  flight: FlightWithDetails
  onDrawer: (flight: FlightWithDetails) => void
}) {
  const state = staffing(flight)
  const startsSoon = differenceInHours(parseISO(flight.departure_utc), new Date()) < 2
  const rowState = flight.status === 'cancelled' ? styles.cancelled : state.missing > 0 && startsSoon ? styles.critical : state.missing > 0 ? styles.understaffed : ''

  return (
    <div className={`${styles.flightRow} ${rowState}`}>
      <span>{format(parseISO(flight.departure_utc), 'HH:mm')}</span>
      <button className={styles.flightLink} onClick={() => onDrawer(flight)} type="button">{flight.id}</button>
      <span>{flight.from_airport} → {flight.to_airport}</span>
      <span>{flight.aircraft_type} · {flight.aircraft_reg}</span>
      <CrewSlot context={context} crewMembers={crewMembers} dragCrew={dragCrew} flight={flight} label="Captain" role="Captain" slotType="captain" />
      <CrewSlot context={context} crewMembers={crewMembers} dragCrew={dragCrew} flight={flight} label="FO" role="FO" slotType="first_officer" />
      <CrewSlot context={context} crewMembers={crewMembers} dragCrew={dragCrew} flight={flight} label="Cabin" role="Cabin" slotType="cabin" />
      <span className={startsSoon && state.missing > 0 ? styles.pulse : ''}><StatusDot color={state.missing ? 'amber' : 'green'} /> {state.missing ? `${state.missing} open` : 'Staffed'}</span>
      <button className={styles.rowMenu} type="button"><MoreHorizontal size={16} strokeWidth={1.5} /></button>
    </div>
  )
}

function slotMembers(flight: FlightWithDetails, role: string) {
  return flight.assignments.filter((assignment) => assignment.role_on_flight === role && assignment.crew)
}

function CrewSlot({
  context,
  crewMembers,
  dragCrew,
  flight,
  label,
  role,
  slotType
}: {
  context: { allAssignments: FlightWithDetails[]; leaveRequests: LeaveRequest[] }
  crewMembers: Profile[]
  dragCrew: Profile | null
  flight: FlightWithDetails
  label: string
  role: string
  slotType: SlotType
}) {
  const assign = useAssignCrew()
  const remove = useRemoveAssignment()
  const toast = useToastStore((state) => state.toast)
  const [shake, setShake] = useState(false)
  const members = slotMembers(flight, role)
  const compatible = dragCrew ? checkAllConflicts(dragCrew, flight, slotType, context).every((conflict) => conflict.severity !== 'block') : false

  const assignCrew = (member: Profile) => {
    const conflicts = checkAllConflicts(member, flight, slotType, context)
    const blocker = conflicts.find((conflict) => conflict.severity === 'block')
    if (blocker) {
      toast(blocker.message)
      setShake(true)
      window.setTimeout(() => setShake(false), 350)
      return
    }
    const warning = conflicts.find((conflict) => conflict.severity === 'warn')
    if (warning && !window.confirm(`${warning.message} Continue with override?`)) return
    assign.mutate({ crewId: member.id, flightId: flight.id, role }, {
      onSuccess: () => toast(`Assigned ${member.full_name} to ${flight.id}`, () => remove.mutate(`${flight.id}:${member.id}`)),
      onError: (error) => toast((error as Error).message)
    })
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <div
          className={`${styles.slot} ${members.length ? styles.filledSlot : ''} ${dragCrew && compatible ? styles.dropReady : ''} ${shake ? styles.shake : ''}`}
          onDragOver={(event) => {
            if (compatible || Array.from(event.dataTransfer.types).includes('text/plain')) event.preventDefault()
          }}
          onDrop={(event) => {
            event.preventDefault()
            const droppedCrewId = event.dataTransfer.getData('text/plain')
            const droppedCrew = dragCrew ?? crewMembers.find((member) => member.id === droppedCrewId) ?? null
            if (droppedCrew) assignCrew(droppedCrew)
          }}
          role="button"
          tabIndex={0}
        >
          {members.length ? members.map((assignment) => assignment.crew ? (
            <span className={styles.slotChip} key={assignment.id}>
              <Avatar initials={assignment.crew.initials} size="sm" />
              <span>{assignment.crew.full_name}</span>
              <button onClick={(event) => { event.stopPropagation(); remove.mutate(assignment.id); toast(`Removed ${assignment.crew?.full_name} from ${flight.id}`) }} type="button"><X size={14} strokeWidth={1.5} /></button>
            </span>
          ) : null) : <span>+ {label}</span>}
        </div>
      </Popover.Trigger>
      <QuickAssign context={context} flight={flight} role={role} slotType={slotType} />
    </Popover.Root>
  )
}

function QuickAssign({ context, flight, role, slotType }: { context: { allAssignments: FlightWithDetails[]; leaveRequests: LeaveRequest[] }; flight: FlightWithDetails; role: string; slotType: SlotType }) {
  const crew = useCrew()
  const assign = useAssignCrew()
  const toast = useToastStore((state) => state.toast)
  const [filter, setFilter] = useState('')
  const candidates = (crew.data ?? [])
    .filter((member) => checkAllConflicts(member, flight, slotType, { allAssignments: [], leaveRequests: [] }).every((conflict) => conflict.message !== `${member.full_name} cannot be assigned to ${slotType.replace('_', ' ')} slot.`))
    .filter((member) => member.full_name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => a.monthly_hours_used - b.monthly_hours_used)

  return (
    <Popover.Portal>
      <Popover.Content className={styles.quickAssign} sideOffset={8}>
        <strong>Assign {role}</strong>
        <small>{flight.id} · {flight.from_airport}→{flight.to_airport} · {format(parseISO(flight.departure_utc), 'HH:mm')}</small>
        <Input autoFocus onChange={(event) => setFilter(event.target.value)} placeholder="Filter crew" value={filter} />
        <Overline>Suggested</Overline>
        <div className={styles.quickList}>
          {candidates.map((member) => {
            const conflicts = checkAllConflicts(member, flight, slotType, context)
            const blocked = conflicts.some((conflict) => conflict.severity === 'block')
            return (
              <button
                disabled={blocked}
                key={member.id}
                onClick={() => assign.mutate({ crewId: member.id, flightId: flight.id, role }, { onSuccess: () => toast(`Assigned ${member.full_name} to ${flight.id}`) })}
                type="button"
              >
                <Avatar initials={member.initials} size="sm" />
                <span>{member.full_name}</span>
                <small>{member.monthly_hours_used}/{member.monthly_hours_max}h</small>
                {conflicts.length ? <AlertTriangle size={14} strokeWidth={1.5} /> : <span>✓</span>}
              </button>
            )
          })}
        </div>
      </Popover.Content>
    </Popover.Portal>
  )
}

function WeekBoard({ flights, onSelect, selectedDate }: { flights: FlightWithDetails[]; onSelect: (date: Date) => void; selectedDate: Date }) {
  const week = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), index))
  const codes = Array.from(new Set(flights.map((flight) => flight.id.replace(/-\d+$/, ''))))
  return (
    <section className={styles.weekBoard}>
      <div className={styles.weekGrid} style={{ gridTemplateColumns: `160px repeat(7, minmax(96px, 1fr))` }}>
        <span />
        {week.map((day) => {
          const dayFlights = flights.filter((flight) => isSameDay(parseISO(flight.departure_utc), day))
          const issues = dayFlights.filter((flight) => staffing(flight).missing > 0).length
          return <button className={isSameDay(day, new Date()) ? styles.todayCol : ''} key={day.toISOString()} onClick={() => onSelect(day)} type="button">{format(day, 'EEE dd')}<small>● {dayFlights.length} flights {issues ? `⚠ ${issues}` : ''}</small></button>
        })}
        {codes.map((code) => (
          <>
            <strong key={`${code}-label`}>{code}</strong>
            {week.map((day) => {
              const flight = flights.find((item) => item.id.startsWith(code) && isSameDay(parseISO(item.departure_utc), day))
              return (
                <button className={flight ? staffing(flight).missing ? styles.weekWarn : styles.weekOk : styles.hatched} key={`${code}-${day.toISOString()}`} onClick={() => onSelect(day)} type="button">
                  {flight ? staffing(flight).missing ? `${staffing(flight).missing} open` : '●' : '─'}
                </button>
              )
            })}
          </>
        ))}
      </div>
    </section>
  )
}

function AddFlightDialog({ onOpenChange, open, selectedDate }: { onOpenChange: (open: boolean) => void; open: boolean; selectedDate: Date }) {
  const addFlight = useAddFlight()
  const toast = useToastStore((state) => state.toast)
  const [form, setForm] = useState<FlightForm>(() => ({
    aircraft_reg: 'VT-ARX',
    aircraft_type: 'A320',
    arrival_utc: datetimeValue(selectedDate, 10, 10),
    departure_utc: datetimeValue(selectedDate, 8, 0),
    distance_km: '1148',
    from_airport: 'DEL',
    id: `AI ${Math.floor(900 + Math.random() * 80)}`,
    required_cabin: '3',
    required_captains: '1',
    required_fos: '1',
    to_airport: 'BOM'
  }))

  useEffect(() => {
    if (!open) return
    setForm((state) => ({
      ...state,
      arrival_utc: datetimeValue(selectedDate, 10, 10),
      departure_utc: datetimeValue(selectedDate, 8, 0)
    }))
  }, [open, selectedDate])

  const updateForm = (field: keyof FlightForm, value: string) => setForm((state) => ({ ...state, [field]: value }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (form.from_airport === form.to_airport) {
      toast('Origin and destination must be different.')
      return
    }
    const departure = new Date(form.departure_utc)
    const arrival = new Date(form.arrival_utc)
    if (arrival <= departure) {
      toast('Arrival must be after departure.')
      return
    }
    const flight: FlightInput = {
      aircraft_reg: form.aircraft_reg.trim().toUpperCase(),
      aircraft_type: form.aircraft_type.trim().toUpperCase(),
      arrival_utc: arrival.toISOString(),
      cruising_alt: 'FL350',
      departure_utc: departure.toISOString(),
      distance_km: Number(form.distance_km),
      from_airport: form.from_airport,
      id: form.id.trim().toUpperCase(),
      required_cabin: Number(form.required_cabin),
      required_captains: Number(form.required_captains),
      required_fos: Number(form.required_fos),
      status: 'scheduled',
      to_airport: form.to_airport
    }
    addFlight.mutate(flight, {
      onError: (error) => toast((error as Error).message),
      onSuccess: () => {
        toast(`${flight.id} added to the board`)
        onOpenChange(false)
      }
    })
  }

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.drawerOverlay} />
        <Dialog.Content className={styles.flightDialog}>
          <div className={styles.dialogHeader}>
            <div>
              <Overline>Flight operations</Overline>
              <h2>Add flight</h2>
            </div>
            <Dialog.Close className={styles.drawerClose}><X size={16} strokeWidth={1.5} /></Dialog.Close>
          </div>
          <Dialog.Description className={styles.visuallyHidden}>Create a scheduled flight for the selected operations date.</Dialog.Description>
          <form className={styles.flightForm} onSubmit={submit}>
            <Input label="Flight number" onChange={(event) => updateForm('id', event.target.value)} required value={form.id} />
            <label className={styles.selectField}>
              From
              <select onChange={(event) => updateForm('from_airport', event.target.value)} value={form.from_airport}>
                {demoAirports.map((airportItem) => <option key={airportItem.iata} value={airportItem.iata}>{airportItem.iata} · {airportItem.city}</option>)}
              </select>
            </label>
            <label className={styles.selectField}>
              To
              <select onChange={(event) => updateForm('to_airport', event.target.value)} value={form.to_airport}>
                {demoAirports.map((airportItem) => <option key={airportItem.iata} value={airportItem.iata}>{airportItem.iata} · {airportItem.city}</option>)}
              </select>
            </label>
            <Input label="Departure" onChange={(event) => updateForm('departure_utc', event.target.value)} required type="datetime-local" value={form.departure_utc} />
            <Input label="Arrival" onChange={(event) => updateForm('arrival_utc', event.target.value)} required type="datetime-local" value={form.arrival_utc} />
            <Input label="Aircraft type" onChange={(event) => updateForm('aircraft_type', event.target.value)} required value={form.aircraft_type} />
            <Input label="Registration" onChange={(event) => updateForm('aircraft_reg', event.target.value)} required value={form.aircraft_reg} />
            <Input label="Distance km" min={1} onChange={(event) => updateForm('distance_km', event.target.value)} required type="number" value={form.distance_km} />
            <Input label="Captains" min={1} onChange={(event) => updateForm('required_captains', event.target.value)} required type="number" value={form.required_captains} />
            <Input label="FOs" min={1} onChange={(event) => updateForm('required_fos', event.target.value)} required type="number" value={form.required_fos} />
            <Input label="Cabin" min={1} onChange={(event) => updateForm('required_cabin', event.target.value)} required type="number" value={form.required_cabin} />
            <div className={styles.formActions}>
              <Button onClick={() => onOpenChange(false)} variant="ghost">Cancel</Button>
              <Button disabled={addFlight.isPending} type="submit">{addFlight.isPending ? 'Adding' : 'Add flight'}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function FlightDrawer({ flight, onClose }: { flight: FlightWithDetails | null; onClose: () => void }) {
  return (
    <Dialog.Root onOpenChange={(open) => { if (!open) onClose() }} open={Boolean(flight)}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.drawerOverlay} />
        <Dialog.Content className={styles.drawer}>
          <Dialog.Close className={styles.drawerClose}><X size={16} strokeWidth={1.5} /></Dialog.Close>
          <Dialog.Description className={styles.visuallyHidden}>View flight details, assigned crew, duty compliance, and flight actions.</Dialog.Description>
          {flight ? (
            <>
              <Overline>Flight details</Overline>
              <h2>{flight.id}</h2>
              <dl className={styles.kv}>
                <dt>Route</dt><dd>{flight.from_airport} → {flight.to_airport}</dd>
                <dt>Departure</dt><dd>{format(parseISO(flight.departure_utc), 'dd MMM HH:mm')}</dd>
                <dt>Arrival</dt><dd>{format(parseISO(flight.arrival_utc), 'dd MMM HH:mm')}</dd>
                <dt>Aircraft</dt><dd>{flight.aircraft_type} · {flight.aircraft_reg}</dd>
              </dl>
              <Overline>Crew assigned</Overline>
              <div className={styles.drawerCrew}>
                {flight.assignments.map((assignment) => assignment.crew ? <span key={assignment.id}><Avatar initials={assignment.crew.initials} /> {assignment.crew.full_name}<small>{assignment.role_on_flight}</small></span> : null)}
              </div>
              <Overline>Duty compliance</Overline>
              <p>{staffing(flight).missing ? `${staffing(flight).missing} open position(s)` : 'All assigned crew currently OK.'}</p>
              <Overline>Actions</Overline>
              <div className={styles.drawerActions}><Button variant="ghost">Edit</Button><Button variant="ghost">Duplicate</Button><Button variant="danger">Cancel</Button></div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function CrewPage() {
  const crew = useCrew()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = (crew.data ?? []).find((member) => member.id === selectedId) ?? null
  return (
    <Layout>
      <section className={styles.page}>
        <div className={styles.headerRow}><Header title="Crew" /><Button><Plus size={16} strokeWidth={1.5} /> Add crew</Button></div>
        <table className={styles.table}>
          <thead><tr><th>Name</th><th>Rank</th><th>Type</th><th>Base</th><th>Monthly hours</th><th>Leave</th></tr></thead>
          <tbody>{(crew.data ?? []).map((member) => (
            <tr key={member.id} onClick={() => setSelectedId(member.id)}>
              <td>{member.full_name}</td><td>{member.rank}</td><td>{member.crew_type}</td><td>{member.base_airport}</td><td><DutyBar max={member.monthly_hours_max} used={member.monthly_hours_used} /></td><td>{member.leave_balance}</td>
            </tr>
          ))}</tbody>
        </table>
        {selected ? <CrewDetailPanel member={selected} onClose={() => setSelectedId(null)} /> : null}
      </section>
    </Layout>
  )
}

type CrewForm = {
  base_airport: string
  leave_balance: string
  monthly_hours_max: string
  monthly_hours_used: string
  rank: string
}

function formFromCrew(member: Profile): CrewForm {
  return {
    base_airport: member.base_airport ?? '',
    leave_balance: String(member.leave_balance),
    monthly_hours_max: String(member.monthly_hours_max),
    monthly_hours_used: String(member.monthly_hours_used),
    rank: member.rank ?? ''
  }
}

function CrewDetailPanel({ member, onClose }: { member: Profile; onClose: () => void }) {
  const update = useUpsertCrew()
  const toast = useToastStore((state) => state.toast)
  const [form, setForm] = useState<CrewForm>(() => formFromCrew(member))

  useEffect(() => {
    setForm(formFromCrew(member))
  }, [member])

  return (
    <aside className={styles.detailPanel}>
      <button aria-label="Close crew detail" onClick={onClose} type="button"><X size={16} strokeWidth={1.5} /></button>
      <h2>{member.full_name}</h2>
      <p>{member.employee_id} · {member.crew_type ?? 'ops'} · {member.role}</p>
      <DutyBar max={Number(form.monthly_hours_max) || member.monthly_hours_max} used={Number(form.monthly_hours_used) || 0} />
      <form
        className={styles.crewEditForm}
        onSubmit={(event) => {
          event.preventDefault()
          const nextProfile: Profile = {
            ...member,
            base_airport: form.base_airport.trim().toUpperCase(),
            leave_balance: Number(form.leave_balance),
            monthly_hours_max: Number(form.monthly_hours_max),
            monthly_hours_used: Number(form.monthly_hours_used),
            rank: form.rank.trim()
          }
          update.mutate(nextProfile, {
            onError: (error) => toast((error as Error).message),
            onSuccess: () => toast(`${member.full_name} updated`)
          })
        }}
      >
        <Input label="Rank" onChange={(event) => setForm((state) => ({ ...state, rank: event.target.value }))} value={form.rank} />
        <Input label="Base airport" maxLength={3} onChange={(event) => setForm((state) => ({ ...state, base_airport: event.target.value }))} value={form.base_airport} />
        <Input label="Hours used" min={0} onChange={(event) => setForm((state) => ({ ...state, monthly_hours_used: event.target.value }))} type="number" value={form.monthly_hours_used} />
        <Input label="Monthly max" min={1} onChange={(event) => setForm((state) => ({ ...state, monthly_hours_max: event.target.value }))} type="number" value={form.monthly_hours_max} />
        <Input label="Leave balance" min={0} onChange={(event) => setForm((state) => ({ ...state, leave_balance: event.target.value }))} type="number" value={form.leave_balance} />
        <Button disabled={update.isPending} fullWidth type="submit">{update.isPending ? 'Updating' : 'Update crew member'}</Button>
      </form>
    </aside>
  )
}

function LeavePage() {
  const leave = useLeaveRequests()
  const update = useUpdateLeaveStatus()
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const rows = (leave.data ?? []).filter((request) => filter === 'all' || request.status === filter)
  return (
    <Layout>
      <section className={styles.page}>
        <Header title="Leave" />
        <div className={styles.chips}>{(['all', 'pending', 'approved', 'rejected'] as const).map((chip) => <button className={filter === chip ? styles.chipActive : ''} key={chip} onClick={() => setFilter(chip)} type="button">{chip}</button>)}</div>
        <table className={styles.table}>
          <thead><tr><th>Crew</th><th>Type</th><th>From</th><th>To</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{rows.map((request) => (
            <tr key={request.id}>
              <td>{request.crew?.full_name}</td><td>{request.leave_type}</td><td>{request.from_date}</td><td>{request.to_date}</td><td><Badge variant={request.status === 'approved' ? 'ok' : request.status === 'rejected' ? 'danger' : 'warn'}>{request.status}</Badge></td>
              <td><Button onClick={() => update.mutate({ id: request.id, status: 'approved' })} size="sm" variant="ghost">Approve</Button> <Button onClick={() => update.mutate({ id: request.id, status: 'rejected' })} size="sm" variant="ghost">Reject</Button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </Layout>
  )
}

function Settings() {
  return (
    <Layout>
      <section className={styles.page}>
        <Header title="Settings" />
        <div className={styles.settingsGrid}>
          {['Airline info', 'Duty rules', 'Aircraft types', 'Danger zone'].map((title) => <Panel key={title} title={title}><p>Configure {title.toLowerCase()}.</p></Panel>)}
        </div>
      </section>
    </Layout>
  )
}

function Shortcuts() {
  return (
    <Layout>
      <section className={styles.page}>
        <Header title="Shortcuts" />
        <div className={styles.shortcutGrid}>{['/ Focus crew search', 'D Day mode', 'W Week mode', '← → Navigate date', 'T Today', 'Esc Close overlay'].map((item) => <span key={item}>{item}</span>)}</div>
      </section>
    </Layout>
  )
}

function App() {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route element={<Protected><Dashboard /></Protected>} path="/dashboard" />
          <Route element={<Protected><FlightBoard /></Protected>} path="/flights" />
          <Route element={<Protected adminOnly><CrewPage /></Protected>} path="/crew" />
          <Route element={<Protected><LeavePage /></Protected>} path="/leave" />
          <Route element={<Protected adminOnly><Settings /></Protected>} path="/settings" />
          <Route element={<Protected><Shortcuts /></Protected>} path="/shortcuts" />
          <Route element={<DemoBootstrap />} path="/demo/:role" />
          <Route element={<Unauthorized />} path="/unauthorized" />
          <Route element={<Navigate to="/flights" />} path="*" />
        </Routes>
      </Router>
    </Tooltip.Provider>
  )
}

const rootElement = document.getElementById('root')!
const root = window.__airrosterOpsRoot ?? createRoot(rootElement)
window.__airrosterOpsRoot = root

root.render(
  <QueryClientProvider client={qc}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
)
