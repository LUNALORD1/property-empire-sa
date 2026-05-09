-- Properties additions
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS listed_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at DATE,
  ADD COLUMN IF NOT EXISTS tier INTEGER;

-- Backfill tier from listing_price (Tier 1 <500k, 2 <1.5M, 3 <4M, 4 <12M, 5 >=12M)
UPDATE public.properties SET tier = CASE
  WHEN listing_price < 500000 THEN 1
  WHEN listing_price < 1500000 THEN 2
  WHEN listing_price < 4000000 THEN 3
  WHEN listing_price < 12000000 THEN 4
  ELSE 5
END
WHERE tier IS NULL;

-- Backfill image_url for existing 120 — Picsum deterministic per id
UPDATE public.properties
  SET image_url = 'https://picsum.photos/seed/prop-' || substring(id::text, 1, 8) || '/800/600'
  WHERE image_url IS NULL;

-- Backfill listed_at + expires_at for existing active listings
UPDATE public.properties
  SET listed_at = COALESCE(listed_at, created_at),
      expires_at = COALESCE(expires_at, (CURRENT_DATE + (7 + floor(random()*15))::int))
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS properties_status_tier_idx ON public.properties(status, tier);
CREATE INDEX IF NOT EXISTS properties_expires_idx ON public.properties(expires_at) WHERE status = 'active';

-- Player properties: track vacancy time for applicant growth
ALTER TABLE public.player_properties
  ADD COLUMN IF NOT EXISTS vacancy_started_at DATE;

-- Backfill vacant rows
UPDATE public.player_properties
  SET vacancy_started_at = CURRENT_DATE
  WHERE status = 'vacant' AND vacancy_started_at IS NULL;

-- Profiles: gazette tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_gazette_shown DATE;

-- News events: rate event support
ALTER TABLE public.news_events
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'price',
  ADD COLUMN IF NOT EXISTS rate_delta NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.market_news
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'price',
  ADD COLUMN IF NOT EXISTS rate_delta NUMERIC NOT NULL DEFAULT 0;

-- Market refresh log
CREATE TABLE IF NOT EXISTS public.market_refresh_log (
  refresh_date DATE PRIMARY KEY,
  removed INTEGER NOT NULL DEFAULT 0,
  added INTEGER NOT NULL DEFAULT 0,
  expired INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.market_refresh_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Refresh log readable by anyone" ON public.market_refresh_log;
CREATE POLICY "Refresh log readable by anyone" ON public.market_refresh_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "Refresh log writable by authenticated" ON public.market_refresh_log;
CREATE POLICY "Refresh log writable by authenticated" ON public.market_refresh_log FOR INSERT TO authenticated WITH CHECK (true);

-- Add interest-rate news event seeds (idempotent on event_key unique)
INSERT INTO public.news_events (event_key, headline, city_id, price_modifier, weight, event_type, rate_delta) VALUES
  ('sarb_hike_50',  'SARB announces repo rate hike of 0.5% — bond holders feel the pinch', NULL, 0,     2, 'rate_hike', 0.5),
  ('sarb_cut_25',   'SARB cuts repo rate by 0.25% — bond repayments ease',                  NULL, 0,     2, 'rate_cut',  -0.25),
  ('sarb_hold',     'Prime rate holds steady this month',                                   NULL, 0,     3, 'rate_hold', 0)
ON CONFLICT (event_key) DO UPDATE
  SET event_type = EXCLUDED.event_type,
      rate_delta = EXCLUDED.rate_delta;