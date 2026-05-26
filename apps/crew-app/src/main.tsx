import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, type FlightWithDetails, useAuth, useFlights, useOwnLeaveRequests, useOwnRoster, useSubmitLeave, useWeather } from '@supabase'
import { Avatar, Badge, Button, DutyBar, Input, Overline, ToastViewport, useToastStore } from '@ui/index'
import '@ui/styles.css'
import { addDays, differenceInHours, differenceInMinutes, format, intervalToDuration, isSameDay, parseISO, startOfWeek } from 'date-fns'
import { CalendarDays, ClipboardList, Plane, UserRound } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { BrowserRouter as Router, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import styles from './styles.module.css'

const qc = new QueryClient()

declare global {
  interface Window {
    __airrosterCrewRoot?: Root
  }
}

function LoadingScreen() {
  return <div className={styles.centerState}>Loading AirRoster Crew</div>
}

function Protected({ children }: { children: ReactNode }) {
  const { loading, profile, role } = useAuth()
  if (loading) return <LoadingScreen />
  if (!profile) return <Navigate to="/unauthorized" />
  if (role !== 'pilot' && role !== 'cabin_crew') return <Navigate to="/unauthorized" />
  return children
}

function Layout({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const nav = [
    ['My Roster', '/', CalendarDays],
    ['Flights', '/flights', Plane],
    ['Leave', '/leave', ClipboardList],
    ['Profile', '/profile', UserRound]
  ] as const
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><span>AirRoster</span><small>CREW PORTAL</small></div>
        <nav>{nav.map(([label, path, Icon]) => <NavLink className={({ isActive }) => isActive ? styles.activeNav : styles.navItem} key={path} to={path}><Icon size={16} strokeWidth={1.5} /> {label}</NavLink>)}</nav>
        <div className={styles.profileChip}><Avatar initials={profile?.initials ?? 'AR'} /><div>{profile?.full_name}<small>{profile?.rank}</small></div></div>
      </aside>
      <main className={styles.main}>{children}</main>
      <ToastViewport />
    </div>
  )
}

function useCrewRosterData() {
  const { profile } = useAuth()
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekStartIso = `${weekStart}T00:00:00+05:30`
  const roster = useOwnRoster(profile?.id ?? null, weekStart)
  const flights = useFlights(weekStartIso)
  return { flights, profile, roster, weekStart }
}

function ownFlights(profileId: string | null, flights: FlightWithDetails[]) {
  if (!profileId) return []
  return flights.filter((flight) => flight.assignments.some((assignment) => assignment.crew_id === profileId))
}

function Home() {
  const { flights, profile, roster } = useCrewRosterData()
  const navigate = useNavigate()
  const flightsForCrew = ownFlights(profile?.id ?? null, flights.data ?? [])
  const todayFlights = flightsForCrew.filter((flight) => isSameDay(parseISO(flight.departure_utc), new Date()))
  const greeting = profile?.rank?.includes('Capt') ? `Good morning, Capt. ${profile.full_name.split(' ')[0]}.` : `Good morning, ${profile?.full_name.split(' ')[0] ?? 'Crew'}.`
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), index))

  if (flights.isLoading || roster.isLoading) return <Layout><LoadingScreen /></Layout>

  return (
    <Layout>
      <section className={styles.home}>
        <h1>{greeting}</h1>
        <p>You have {todayFlights.length} flights today.</p>
        <div className={styles.flightCards}>
          {todayFlights.map((flight) => {
            const assignment = flight.assignments.find((item) => item.crew_id === profile?.id)
            return (
              <button className={styles.flightCard} key={flight.id} onClick={() => navigate(`/flights/${flight.id}`)} type="button">
                <span>{flight.id}</span>
                <small>{flight.from_airport} → {flight.to_airport}</small>
                <strong>{format(parseISO(flight.departure_utc), 'HH:mm')}</strong>
                <em>{assignment?.role_on_flight ?? profile?.rank}</em>
              </button>
            )
          })}
        </div>
        <section className={styles.weekList}>
          <Overline>This week</Overline>
          {weekDays.map((day) => {
            const dayFlights = flightsForCrew.filter((flight) => isSameDay(parseISO(flight.departure_utc), day))
            const rosterEntry = (roster.data ?? []).find((entry) => entry.date === format(day, 'yyyy-MM-dd'))
            return (
              <div key={day.toISOString()}>
                <span>{format(day, 'EEEE')}</span>
                <strong>{dayFlights.map((flight) => flight.id).join(', ') || rosterEntry?.entry_type || 'Off'}</strong>
              </div>
            )
          })}
        </section>
      </section>
    </Layout>
  )
}

function FlightsToday() {
  const { flights, profile } = useCrewRosterData()
  const navigate = useNavigate()
  const rows = ownFlights(profile?.id ?? null, flights.data ?? []).filter((flight) => isSameDay(parseISO(flight.departure_utc), new Date()))
  return (
    <Layout>
      <section className={styles.page}>
        <Overline>Flights today</Overline>
        <h1>Briefings</h1>
        <div className={styles.briefingList}>{rows.map((flight) => <button key={flight.id} onClick={() => navigate(`/flights/${flight.id}`)} type="button">{flight.id}<span>{flight.from_airport} → {flight.to_airport}</span><strong>{format(parseISO(flight.departure_utc), 'HH:mm')}</strong></button>)}</div>
      </section>
    </Layout>
  )
}

function Briefing() {
  const { flightId } = useParams()
  const { flights, profile } = useCrewRosterData()
  const flight = (flights.data ?? []).find((item) => item.id === flightId)
  const weather = useWeather(flight ? [flight.from_airport ?? '', flight.to_airport ?? ''].filter(Boolean) : [])
  const weatherByCode = new Map((weather.data ?? []).map((item) => [item.airport_iata, item]))

  if (flights.isLoading || !flight) return <Layout><LoadingScreen /></Layout>

  const duration = intervalToDuration({ end: parseISO(flight.arrival_utc), start: parseISO(flight.departure_utc) })
  const countdownMinutes = differenceInMinutes(parseISO(flight.departure_utc), new Date())
  const restHours = 9

  return (
    <Layout>
      <article className={styles.briefing}>
        <header className={styles.briefingHero}>
          <div>
            <Overline>Flight</Overline>
            <h1>{flight.id}</h1>
            <p>{flight.from?.city ?? flight.from_airport} → {flight.to?.city ?? flight.to_airport}</p>
            <small>{flight.from_airport} → {flight.to_airport}</small>
            <small>{format(parseISO(flight.departure_utc), 'dd MMM yyyy')} · {flight.aircraft_type} · {flight.aircraft_reg}</small>
          </div>
          <div className={styles.countdown}><span>Departure in</span><strong>{countdownMinutes > 0 ? `${Math.floor(countdownMinutes / 60)}h ${countdownMinutes % 60}m` : 'Boarding'}</strong></div>
        </header>
        <BriefingSection title="Flight info">
          <KeyGrid rows={[
            ['Departure local', format(parseISO(flight.departure_utc), 'HH:mm')],
            ['Departure UTC', format(parseISO(flight.departure_utc), "HH:mm 'UTC'")],
            ['Arrival local', format(parseISO(flight.arrival_utc), 'HH:mm')],
            ['Arrival UTC', format(parseISO(flight.arrival_utc), "HH:mm 'UTC'")],
            ['Duration', `${duration.hours ?? 0}h ${duration.minutes ?? 0}m`],
            ['Aircraft type', flight.aircraft_type ?? 'TBD'],
            ['Registration', flight.aircraft_reg ?? 'TBD'],
            ['Cruising altitude', flight.cruising_alt ?? 'FL350']
          ]} />
        </BriefingSection>
        <BriefingSection title="Route">
          <KeyGrid rows={[['Distance', `${flight.distance_km ?? 0} km / ${Math.round((flight.distance_km ?? 0) * 0.54)} NM`], ['Est. FDP', '5h 10m'], ['Time breakdown', 'Taxi 20m · climb 18m · cruise 1h 42m · descent 20m']]} />
          <RouteMap
            distanceKm={flight.distance_km ?? 0}
            from={{
              city: flight.from?.city ?? flight.from_airport ?? 'Departure',
              code: flight.from_airport ?? 'DEP',
              lat: flight.from?.lat ?? 28.5562,
              lng: flight.from?.lng ?? 77.1
            }}
            to={{
              city: flight.to?.city ?? flight.to_airport ?? 'Arrival',
              code: flight.to_airport ?? 'ARR',
              lat: flight.to?.lat ?? 19.0896,
              lng: flight.to?.lng ?? 72.8656
            }}
          />
        </BriefingSection>
        <BriefingSection title="Weather">
          <div className={styles.weatherGrid}>
            {[flight.from_airport, flight.to_airport].map((code) => code ? <WeatherCard code={code} key={code} weather={weatherByCode.get(code)} /> : null)}
          </div>
        </BriefingSection>
        <BriefingSection title="Crew on this flight">
          <div className={styles.crewGroups}>
            <CrewGroup label="Pilots" members={flight.assignments.filter((assignment) => assignment.crew?.crew_type === 'pilot')} />
            <CrewGroup label="Cabin crew" members={flight.assignments.filter((assignment) => assignment.crew?.crew_type === 'cabin')} />
          </div>
        </BriefingSection>
        <BriefingSection title="Duty & rest">
          <KeyGrid rows={[
            ['Report time', format(parseISO(flight.departure_utc), 'HH:mm')],
            ['End of duty', format(parseISO(flight.arrival_utc), 'HH:mm')],
            ['Total FDP', '5h 10m'],
            ['Rest before this flight', `${restHours}h`]
          ]} />
          {restHours < 10 ? <Badge variant="warn">Below DGCA minimum</Badge> : null}
          <p className={styles.discreet}>Viewing as {profile?.full_name}</p>
        </BriefingSection>
      </article>
    </Layout>
  )
}

function BriefingSection({ children, title }: { children: ReactNode; title: string }) {
  return <section className={styles.briefingSection}><Overline>{title}</Overline>{children}</section>
}

function KeyGrid({ rows }: { rows: [string, string][] }) {
  return <dl className={styles.keyGrid}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

type MapPoint = {
  city: string
  code: string
  lat: number
  lng: number
}

function projectPoint(point: MapPoint) {
  const minLng = 67
  const maxLng = 91
  const minLat = 6
  const maxLat = 36
  const x = 80 + ((point.lng - minLng) / (maxLng - minLng)) * 640
  const y = 320 - ((point.lat - minLat) / (maxLat - minLat)) * 250
  return {
    x: Math.max(70, Math.min(730, x)),
    y: Math.max(54, Math.min(326, y))
  }
}

function RouteMap({ distanceKm, from, to }: { distanceKm: number; from: MapPoint; to: MapPoint }) {
  const start = projectPoint(from)
  const end = projectPoint(to)
  const midX = (start.x + end.x) / 2
  const midY = Math.min(start.y, end.y) - Math.max(36, Math.abs(start.x - end.x) * 0.12)
  const path = `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`

  return (
    <svg className={styles.routeMap} viewBox="0 0 800 380" role="img" aria-label={`${from.code} to ${to.code}`}>
      <defs>
        <pattern height="28" id="mapGrid" patternUnits="userSpaceOnUse" width="28">
          <path d="M 28 0 L 0 0 0 28" />
        </pattern>
        <marker id="routeArrow" markerHeight="8" markerWidth="8" orient="auto" refX="6" refY="4">
          <path d="M0,0 L8,4 L0,8" />
        </marker>
      </defs>
      <rect className={styles.mapBase} height="380" width="800" />
      <rect className={styles.mapGrid} height="380" width="800" />
      <path className={styles.landMass} d="M172 74 C236 44 312 60 350 96 C391 135 448 115 505 136 C588 166 614 228 580 284 C540 350 429 338 354 318 C281 299 240 326 173 292 C104 257 88 179 121 126 C133 107 148 88 172 74 Z" />
      <path className={styles.coastLine} d="M207 86 C251 108 285 130 300 172 C318 222 362 249 422 264 C475 278 518 294 548 322" />
      <path className={styles.coastLine} d="M360 75 C408 110 434 144 460 190 C480 226 513 240 562 248" />
      <path className={styles.routeTrace} d={path} markerEnd="url(#routeArrow)" />
      <path className={styles.routeGlow} d={path} />
      <g className={styles.planeMarker}>
        <animateMotion dur="7s" path={path} repeatCount="indefinite" rotate="auto" />
        <path d="M15 0 L-10 -6 L-5 0 L-10 6 Z" />
      </g>
      <AirportPin labelAnchor="end" point={start} station={from} />
      <AirportPin labelAnchor="start" point={end} station={to} />
      <g className={styles.routeMeta}>
        <text x="48" y="48">{from.code} → {to.code}</text>
        <text x="48" y="70">{distanceKm.toLocaleString('en-IN')} km route preview</text>
      </g>
    </svg>
  )
}

function AirportPin({ labelAnchor, point, station }: { labelAnchor: 'end' | 'start'; point: { x: number; y: number }; station: MapPoint }) {
  const labelX = labelAnchor === 'end' ? point.x - 18 : point.x + 18
  return (
    <g className={styles.airportPin}>
      <circle cx={point.x} cy={point.y} r="13" />
      <circle cx={point.x} cy={point.y} r="4" />
      <line x1={point.x} x2={labelX} y1={point.y} y2={point.y - 22} />
      <text textAnchor={labelAnchor} x={labelX} y={point.y - 30}>{station.code}</text>
      <text className={styles.pinCity} textAnchor={labelAnchor} x={labelX} y={point.y - 14}>{station.city}</text>
    </g>
  )
}

function WeatherIcon({ condition }: { condition: string | null | undefined }) {
  if (condition === 'rain') return <svg viewBox="0 0 32 32"><path d="M7 17c1-5 5-8 10-8 4 0 7 3 8 7" /><path d="M10 22v5M16 22v5M22 22v5" /></svg>
  if (condition === 'overcast') return <svg viewBox="0 0 32 32"><path d="M6 18c2-5 6-7 11-6 3 0 6 2 8 5" /><path d="M8 23c4-3 11-3 16 0" /></svg>
  if (condition === 'fog') return <svg viewBox="0 0 32 32"><path d="M5 10c5 2 9-2 14 0s6 0 8-1M5 16c5 2 9-2 14 0s6 0 8-1M5 22c5 2 9-2 14 0s6 0 8-1" /></svg>
  if (condition === 'storm') return <svg viewBox="0 0 32 32"><path d="M6 17c2-5 6-7 11-6 3 0 6 2 8 5" /><path d="M16 19l-3 6h5l-2 5" /></svg>
  if (condition === 'partly-cloudy') return <svg viewBox="0 0 32 32"><circle cx="12" cy="12" r="5" /><path d="M9 21c3-5 11-6 16-1" /></svg>
  return <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="5" /><path d="M16 3v5M16 24v5M3 16h5M24 16h5M7 7l4 4M21 21l4 4M25 7l-4 4M11 21l-4 4" /></svg>
}

function WeatherCard({ code, weather }: { code: string; weather: { condition: string | null; qnh_hpa: number | null; temp_c: number | null; visibility_km: number | null; wind_dir: string | null; wind_kt: number | null } | undefined }) {
  return (
    <article className={styles.weatherCard}>
      <div><strong>{code}</strong><WeatherIcon condition={weather?.condition} /></div>
      <span>{weather?.temp_c ?? '--'}°C</span>
      <p>{weather?.condition ?? 'Unavailable'}</p>
      <small>Wind: {weather?.wind_kt ?? '--'} kt {weather?.wind_dir ?? ''}</small>
      <small>Visibility: {weather?.visibility_km ?? '--'} km</small>
      <small>QNH: {weather?.qnh_hpa ?? '--'} hPa</small>
    </article>
  )
}

function CrewGroup({ label, members }: { label: string; members: FlightWithDetails['assignments'] }) {
  return (
    <div>
      <Overline>{label}</Overline>
      <div className={styles.crewWrap}>{members.map((assignment) => assignment.crew ? <span key={assignment.id}><Avatar initials={assignment.crew.initials} /> <strong>{assignment.crew.full_name}</strong><small>{assignment.crew.rank}</small></span> : null)}</div>
    </div>
  )
}

function Leave() {
  const { profile } = useAuth()
  const requests = useOwnLeaveRequests(profile?.id ?? null)
  const submit = useSubmitLeave()
  const toast = useToastStore((state) => state.toast)
  const [form, setForm] = useState({ from_date: '', leave_type: 'annual', note: '', to_date: '' })
  return (
    <Layout>
      <section className={styles.page}>
        <Overline>Leave</Overline>
        <h1>Requests</h1>
        <form className={styles.leaveForm} onSubmit={(event) => {
          event.preventDefault()
          if (!profile) return
          submit.mutate({ crew_id: profile.id, from_date: form.from_date, leave_type: form.leave_type as 'annual', note: form.note, to_date: form.to_date }, { onSuccess: () => toast('Leave request submitted') })
        }}>
          <Input label="From" onChange={(event) => setForm((state) => ({ ...state, from_date: event.target.value }))} type="date" value={form.from_date} />
          <Input label="To" onChange={(event) => setForm((state) => ({ ...state, to_date: event.target.value }))} type="date" value={form.to_date} />
          <label className={styles.selectLabel}>Type<select onChange={(event) => setForm((state) => ({ ...state, leave_type: event.target.value }))} value={form.leave_type}><option value="annual">Annual</option><option value="sick">Sick</option><option value="training">Training</option></select></label>
          <Input label="Note" onChange={(event) => setForm((state) => ({ ...state, note: event.target.value }))} value={form.note} />
          <Button type="submit">Submit</Button>
        </form>
        <table className={styles.table}><tbody>{(requests.data ?? []).map((request) => <tr key={request.id}><td>{request.leave_type}</td><td>{request.from_date} → {request.to_date}</td><td><Badge variant={request.status === 'approved' ? 'ok' : request.status === 'rejected' ? 'danger' : 'warn'}>{request.status}</Badge></td></tr>)}</tbody></table>
      </section>
    </Layout>
  )
}

function Profile() {
  const { profile, signOut } = useAuth()
  if (!profile) return <LoadingScreen />
  return (
    <Layout>
      <section className={styles.profilePage}>
        <h1>{profile.full_name}</h1>
        <p>{profile.rank} · {profile.employee_id} · {profile.base_airport}</p>
        <Overline>Monthly hours</Overline>
        <DutyBar max={profile.monthly_hours_max} used={profile.monthly_hours_used} />
        <strong>{profile.monthly_hours_used} / {profile.monthly_hours_max} hrs</strong>
        <p>{profile.leave_balance} days remaining</p>
        <Button onClick={() => void signOut()} variant="ghost">Sign out</Button>
      </section>
    </Layout>
  )
}

function Unauthorized() {
  return <div className={styles.centerState}><h1>Unauthorized</h1><p>This portal is available to assigned flight crew only.</p></div>
}

function DemoBootstrap() {
  const { role } = useParams()
  useEffect(() => {
    if (role === 'pilot' || role === 'cabin_crew') {
      window.localStorage.setItem('airroster-demo-role', role)
      window.location.replace('/')
    } else {
      window.location.replace('/unauthorized')
    }
  }, [role])
  return <LoadingScreen />
}

function App() {
  return (
    <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route element={<Protected><Home /></Protected>} path="/" />
        <Route element={<Protected><FlightsToday /></Protected>} path="/flights" />
        <Route element={<Protected><Briefing /></Protected>} path="/flights/:flightId" />
        <Route element={<Protected><Leave /></Protected>} path="/leave" />
        <Route element={<Protected><Profile /></Protected>} path="/profile" />
        <Route element={<DemoBootstrap />} path="/demo/:role" />
        <Route element={<Unauthorized />} path="/unauthorized" />
      </Routes>
    </Router>
  )
}

const rootElement = document.getElementById('root')!
const root = window.__airrosterCrewRoot ?? createRoot(rootElement)
window.__airrosterCrewRoot = root

root.render(
  <QueryClientProvider client={qc}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
)
