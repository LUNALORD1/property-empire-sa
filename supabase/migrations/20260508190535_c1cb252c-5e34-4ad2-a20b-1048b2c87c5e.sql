
-- City price/momentum tracking
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS daily_price_modifier numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS momentum_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modifier_updated_on date;

-- Catalog of news events that can fire
CREATE TABLE IF NOT EXISTS public.news_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  headline text NOT NULL,
  city_id uuid NULL,           -- null = nationwide
  price_modifier numeric NOT NULL,  -- e.g. 0.012 = +1.2%
  weight integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.news_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "News events readable by anyone" ON public.news_events;
CREATE POLICY "News events readable by anyone" ON public.news_events FOR SELECT USING (true);

-- Daily rolled news (one row per event firing on a given date)
CREATE TABLE IF NOT EXISTS public.market_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tick_date date NOT NULL,
  event_key text NOT NULL,
  headline text NOT NULL,
  city_id uuid NULL,
  price_modifier numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tick_date, event_key)
);
ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Market news readable by anyone" ON public.market_news;
CREATE POLICY "Market news readable by anyone" ON public.market_news FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can roll market news" ON public.market_news;
CREATE POLICY "Authenticated users can roll market news" ON public.market_news
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_market_news_date ON public.market_news (tick_date DESC);

-- Per-property 7-day value history
CREATE TABLE IF NOT EXISTS public.property_value_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_property_id uuid NOT NULL,
  player_id uuid NOT NULL,
  recorded_date date NOT NULL,
  value numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_property_id, recorded_date)
);
ALTER TABLE public.property_value_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players manage own value history" ON public.property_value_history;
CREATE POLICY "Players manage own value history" ON public.property_value_history
  FOR ALL USING (auth.uid() = player_id) WITH CHECK (auth.uid() = player_id);
CREATE INDEX IF NOT EXISTS idx_pvh_pp_date ON public.property_value_history (player_property_id, recorded_date DESC);
