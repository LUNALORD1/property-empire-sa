
-- ============= CITIES =============
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  latitude double precision not null,
  longitude double precision not null,
  annual_appreciation_pct numeric not null default 5.0,
  weather_multiplier numeric not null default 1.0,
  created_at timestamptz not null default now()
);
alter table public.cities enable row level security;
create policy "Cities are readable by anyone" on public.cities for select using (true);

insert into public.cities (name, latitude, longitude, annual_appreciation_pct) values
  ('Cape Town', -33.9249, 18.4241, 6.5),
  ('Johannesburg', -26.2041, 28.0473, 4.5),
  ('Pretoria', -25.7479, 28.2293, 4.0),
  ('Durban', -29.8587, 31.0218, 5.0),
  ('Port Elizabeth', -33.9608, 25.6022, 3.5);

-- ============= GAME CONFIG =============
create table public.game_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.game_config enable row level security;
create policy "Game config readable by anyone" on public.game_config for select using (true);

insert into public.game_config (key, value) values
  ('prime_rate', '{"rate": 11.75}'::jsonb),
  ('starting_cash', '{"amount": 500000}'::jsonb),
  ('starting_admin_points', '{"points": 10}'::jsonb);

-- ============= PROPERTIES (the market) =============
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  city_id uuid not null references public.cities(id),
  suburb text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  bedrooms int not null default 2,
  bathrooms int not null default 1,
  listing_price numeric not null,
  photo_url text,
  suburb_avg_price numeric not null,
  suburb_avg_rent numeric not null,
  status text not null default 'active', -- active | sold | removed
  created_at timestamptz not null default now()
);
alter table public.properties enable row level security;
create policy "Market listings readable by signed-in users"
  on public.properties for select to authenticated using (true);
create index properties_city_idx on public.properties(city_id);
create index properties_status_idx on public.properties(status);

-- ============= PROFILES =============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  cash numeric not null default 500000,
  admin_points_cap int not null default 10,
  onboarded boolean not null default false,
  game_started_at timestamptz not null default now(),
  last_tick_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Players read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Players update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Players insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- ============= PLAYER PROPERTIES (owned) =============
create table public.player_properties (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id),
  purchase_price numeric not null,
  current_value numeric not null,
  monthly_rent numeric not null,
  monthly_maintenance numeric not null,
  status text not null default 'rented', -- rented | vacant
  purchased_at timestamptz not null default now(),
  unique (player_id, property_id)
);
alter table public.player_properties enable row level security;
create policy "Players manage own properties"
  on public.player_properties for all
  using (auth.uid() = player_id) with check (auth.uid() = player_id);
create index player_properties_player_idx on public.player_properties(player_id);

-- ============= LOANS =============
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  player_property_id uuid not null references public.player_properties(id) on delete cascade,
  principal numeric not null,
  balance numeric not null,
  interest_rate numeric not null,
  term_months int not null default 240,
  monthly_payment numeric not null,
  ltv numeric not null,
  started_at timestamptz not null default now(),
  active boolean not null default true
);
alter table public.loans enable row level security;
create policy "Players manage own loans"
  on public.loans for all
  using (auth.uid() = player_id) with check (auth.uid() = player_id);

-- ============= LEDGER =============
create table public.ledger (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- rent | maintenance | loan_payment | purchase | sale | luck | assistant | other
  amount numeric not null, -- positive = inflow, negative = outflow
  property_id uuid references public.properties(id),
  description text,
  created_at timestamptz not null default now()
);
alter table public.ledger enable row level security;
create policy "Players read own ledger" on public.ledger for select using (auth.uid() = player_id);
create policy "Players insert own ledger" on public.ledger for insert with check (auth.uid() = player_id);
create index ledger_player_created_idx on public.ledger(player_id, created_at desc);

-- ============= ASSISTANTS =============
create table public.assistants (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  monthly_cost numeric not null default 8000,
  points_added int not null default 10,
  hired_at timestamptz not null default now(),
  active boolean not null default true
);
alter table public.assistants enable row level security;
create policy "Players manage own assistants"
  on public.assistants for all
  using (auth.uid() = player_id) with check (auth.uid() = player_id);

-- ============= LUCK EVENTS =============
create table public.luck_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  title text not null,
  description text,
  amount numeric default 0,
  payload jsonb,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.luck_events enable row level security;
create policy "Players manage own luck events"
  on public.luck_events for all
  using (auth.uid() = player_id) with check (auth.uid() = player_id);

-- ============= ACHIEVEMENTS =============
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  badge_key text not null,
  unlocked_at timestamptz not null default now(),
  unique (player_id, badge_key)
);
alter table public.achievements enable row level security;
create policy "Players manage own achievements"
  on public.achievements for all
  using (auth.uid() = player_id) with check (auth.uid() = player_id);

-- ============= DAILY TICKS =============
create table public.daily_ticks (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  tick_date date not null,
  rent_collected numeric not null default 0,
  maintenance_paid numeric not null default 0,
  loan_paid numeric not null default 0,
  net_cashflow numeric not null default 0,
  summary jsonb,
  created_at timestamptz not null default now(),
  unique (player_id, tick_date)
);
alter table public.daily_ticks enable row level security;
create policy "Players read own ticks" on public.daily_ticks for select using (auth.uid() = player_id);
create policy "Players insert own ticks" on public.daily_ticks for insert with check (auth.uid() = player_id);

-- ============= AUTO-CREATE PROFILE TRIGGER =============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, cash)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    500000
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
