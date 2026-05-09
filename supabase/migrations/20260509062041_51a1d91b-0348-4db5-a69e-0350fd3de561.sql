DROP POLICY IF EXISTS "Refresh log writable by authenticated" ON public.market_refresh_log;
CREATE POLICY "Refresh log insert today only" ON public.market_refresh_log
  FOR INSERT TO authenticated
  WITH CHECK (refresh_date = CURRENT_DATE);