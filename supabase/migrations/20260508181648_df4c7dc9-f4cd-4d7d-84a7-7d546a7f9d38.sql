-- ============================================================
-- Tenant system, sell mechanic, bankruptcy tracking
-- ============================================================

-- ---------- profiles: stats & red-zone tracking ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS peak_net_worth numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_properties_ever integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS game_over boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS red_zone_started_at date;

-- ---------- cities: just for compatibility (kept simple) ----------
-- (Demand is per-property since suburbs are not first-class entities.)

-- ---------- properties: storey + suburb flags + demand ----------
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS single_storey boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_university_suburb boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_coastal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demand_tier text NOT NULL DEFAULT 'medium';

-- Tier 4 / 5 (>= R4M) default to multi-storey
UPDATE public.properties SET single_storey = false WHERE listing_price >= 4000000;

-- University suburbs
UPDATE public.properties SET is_university_suburb = true
WHERE suburb IN ('Hatfield','Rondebosch','Bellville','Glenwood','Summerstrand','Houghton','Newlands','Pinelands');

-- Coastal suburbs
UPDATE public.properties SET is_coastal = true
WHERE suburb IN ('Camps Bay','Clifton','Bluewater Bay','Summerstrand','Mount Edgecombe','Ballito','Kenton-on-Sea','St Francis Bay','Durban North','Berea','Izinga','Sea Point','Mouille Point');

-- Seed initial demand tier roughly by listing price
UPDATE public.properties SET demand_tier =
  CASE
    WHEN listing_price < 700000 THEN 'low'
    WHEN listing_price < 2500000 THEN 'medium'
    WHEN listing_price < 8000000 THEN 'high'
    ELSE 'hot'
  END;

-- ---------- player_properties: condition + lifecycle ----------
ALTER TABLE public.player_properties
  ADD COLUMN IF NOT EXISTS condition_score integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS evicting_until date,
  ADD COLUMN IF NOT EXISTS selling_notice_until date;

-- ---------- New table: renter_types ----------
CREATE TABLE IF NOT EXISTS public.renter_types (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  rent_modifier numeric NOT NULL,
  damage_risk text NOT NULL,           -- very_low / low / medium / high
  reliability integer NOT NULL,        -- 0-100
  lease_months integer NOT NULL,
  min_beds integer NOT NULL DEFAULT 0,
  max_beds integer,
  single_storey_only boolean NOT NULL DEFAULT false,
  university_only boolean NOT NULL DEFAULT false,
  low_demand_only boolean NOT NULL DEFAULT false,
  flavour text,
  icon_key text
);
ALTER TABLE public.renter_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Renter types readable by anyone" ON public.renter_types;
CREATE POLICY "Renter types readable by anyone" ON public.renter_types FOR SELECT USING (true);

INSERT INTO public.renter_types (key, display_name, rent_modifier, damage_risk, reliability, lease_months, min_beds, max_beds, single_storey_only, university_only, low_demand_only, flavour, icon_key) VALUES
  ('young_professional','Young Professional',1.00,'low',95,12,0,NULL,false,false,false,'Steady salary, takes good care of the place.','briefcase'),
  ('student','Student',0.85,'medium',75,6,1,2,false,true,false,'Up late, light on rent, light on damage… mostly.','graduation-cap'),
  ('family','Family',0.92,'low',97,24,3,NULL,false,false,false,'Long-term, pays like clockwork, needs space.','users'),
  ('entrepreneur','Entrepreneur',1.10,'medium',78,12,0,NULL,false,false,false,'Pays well when the business is good.','rocket'),
  ('retiree','Retiree',0.88,'very_low',99,24,0,NULL,true,false,false,'Quiet, reliable, prefers no stairs.','flower'),
  ('party_animal','Party Animal',1.20,'high',80,6,0,NULL,false,false,false,'Premium rent, but the neighbours will call.','music'),
  ('corporate_tenant','Corporate Tenant',1.15,'very_low',100,6,0,NULL,false,false,false,'Company-paid relocations. Boringly perfect.','building'),
  ('opportunist','Opportunist',0.75,'high',60,6,0,NULL,false,false,true,'Cheap rent, sketchy references.','alert-triangle')
ON CONFLICT (key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  rent_modifier = EXCLUDED.rent_modifier,
  damage_risk = EXCLUDED.damage_risk,
  reliability = EXCLUDED.reliability,
  lease_months = EXCLUDED.lease_months,
  min_beds = EXCLUDED.min_beds,
  max_beds = EXCLUDED.max_beds,
  single_storey_only = EXCLUDED.single_storey_only,
  university_only = EXCLUDED.university_only,
  low_demand_only = EXCLUDED.low_demand_only,
  flavour = EXCLUDED.flavour,
  icon_key = EXCLUDED.icon_key;

-- ---------- New table: tenant_applicants ----------
CREATE TABLE IF NOT EXISTS public.tenant_applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  player_property_id uuid NOT NULL,
  renter_type_key text NOT NULL,
  offered_rent numeric NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_applicants_pp ON public.tenant_applicants(player_property_id);
ALTER TABLE public.tenant_applicants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players manage own applicants" ON public.tenant_applicants;
CREATE POLICY "Players manage own applicants" ON public.tenant_applicants
  FOR ALL USING (auth.uid() = player_id) WITH CHECK (auth.uid() = player_id);

-- ---------- New table: tenants ----------
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  player_property_id uuid NOT NULL UNIQUE,
  renter_type_key text NOT NULL,
  monthly_rent numeric NOT NULL,
  lease_start date NOT NULL DEFAULT CURRENT_DATE,
  lease_end date NOT NULL,
  happiness integer NOT NULL DEFAULT 80,
  consecutive_missed_payments integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenants_player ON public.tenants(player_id);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players manage own tenants" ON public.tenants;
CREATE POLICY "Players manage own tenants" ON public.tenants
  FOR ALL USING (auth.uid() = player_id) WITH CHECK (auth.uid() = player_id);

-- ---------- Backfill legacy tenants for existing rented properties ----------
INSERT INTO public.tenants (player_id, player_property_id, renter_type_key, monthly_rent, lease_start, lease_end, happiness)
SELECT pp.player_id, pp.id, 'young_professional', pp.monthly_rent, CURRENT_DATE, CURRENT_DATE + INTERVAL '12 months', 80
FROM public.player_properties pp
WHERE pp.status = 'rented'
ON CONFLICT (player_property_id) DO NOTHING;

-- Backfill total_properties_ever for existing players
UPDATE public.profiles p
SET total_properties_ever = COALESCE((SELECT count(*) FROM public.player_properties WHERE player_id = p.id), 0)
WHERE total_properties_ever = 0;