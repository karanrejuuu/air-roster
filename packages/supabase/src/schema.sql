create type user_role as enum ('admin','dispatcher','pilot','cabin_crew');

create table profiles (
  id                  uuid references auth.users(id) on delete cascade primary key,
  role                user_role not null,
  employee_id         text unique not null,
  full_name           text not null,
  initials            text not null,
  rank                text,
  crew_type           text check (crew_type in ('pilot','cabin')),
  base_airport        text,
  monthly_hours_used  numeric default 0,
  monthly_hours_max   numeric default 90,
  leave_balance       integer default 21,
  created_at          timestamptz default now()
);

create table airports (
  iata     text primary key,
  name     text not null,
  city     text not null,
  lat      numeric not null,
  lng      numeric not null,
  timezone text not null
);

create table flights (
  id               text primary key,
  from_airport     text references airports(iata),
  to_airport       text references airports(iata),
  departure_utc    timestamptz not null,
  arrival_utc      timestamptz not null,
  aircraft_type    text,
  aircraft_reg     text,
  cruising_alt     text default 'FL350',
  distance_km      integer,
  required_captains   integer default 1,
  required_fos        integer default 1,
  required_cabin      integer default 3,
  status           text default 'scheduled',
  created_at       timestamptz default now()
);

create table flight_assignments (
  id              uuid default gen_random_uuid() primary key,
  flight_id       text references flights(id) on delete cascade,
  crew_id         uuid references profiles(id) on delete cascade,
  role_on_flight  text not null,
  created_at      timestamptz default now(),
  unique(flight_id, crew_id)
);

create table roster_entries (
  id          uuid default gen_random_uuid() primary key,
  crew_id     uuid references profiles(id) on delete cascade,
  date        date not null,
  flight_id   text references flights(id),
  entry_type  text not null check (entry_type in ('flight','leave','rest','training','off')),
  created_at  timestamptz default now()
);

create table leave_requests (
  id          uuid default gen_random_uuid() primary key,
  crew_id     uuid references profiles(id) on delete cascade,
  from_date   date not null,
  to_date     date not null,
  leave_type  text not null check (leave_type in ('annual','sick','training')),
  status      text default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  note        text,
  created_at  timestamptz default now()
);

create table weather_cache (
  airport_iata   text references airports(iata) primary key,
  fetched_at     timestamptz default now(),
  temp_c         numeric,
  condition      text,
  wind_kt        numeric,
  wind_dir       text,
  visibility_km  numeric,
  qnh_hpa        numeric
);

alter table profiles          enable row level security;
alter table flights            enable row level security;
alter table flight_assignments enable row level security;
alter table roster_entries     enable row level security;
alter table leave_requests     enable row level security;
alter table weather_cache      enable row level security;

create or replace function get_my_role()
returns user_role as $$
  select role from profiles where id = auth.uid()
$$ language sql security definer;

create policy "profiles_read" on profiles for select
  using (id = auth.uid() or get_my_role() in ('admin','dispatcher'));
create policy "profiles_update_own" on profiles for update using (id = auth.uid());
create policy "profiles_admin" on profiles for all using (get_my_role() = 'admin');
create policy "flights_read"  on flights for select using (auth.role() = 'authenticated');
create policy "flights_write" on flights for all   using (get_my_role() in ('admin','dispatcher'));
create policy "assign_read"  on flight_assignments for select using (auth.role() = 'authenticated');
create policy "assign_write" on flight_assignments for all   using (get_my_role() in ('admin','dispatcher'));
create policy "roster_read"  on roster_entries for select
  using (crew_id = auth.uid() or get_my_role() in ('admin','dispatcher'));
create policy "roster_write" on roster_entries for all
  using (get_my_role() in ('admin','dispatcher'));
create policy "leave_read"   on leave_requests for select
  using (crew_id = auth.uid() or get_my_role() in ('admin','dispatcher'));
create policy "leave_insert" on leave_requests for insert with check (crew_id = auth.uid());
create policy "leave_update" on leave_requests for update using (get_my_role() in ('admin','dispatcher'));
create policy "weather_read" on weather_cache for select using (auth.role() = 'authenticated');
