
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS origination_rate numeric,
  ADD COLUMN IF NOT EXISTS insurance_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_premium_pct numeric NOT NULL DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS overpayment_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_partial_repayment_month text,
  ADD COLUMN IF NOT EXISTS rate_reduction_applied numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_holiday_last_used_at date,
  ADD COLUMN IF NOT EXISTS holiday_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refinanced_at date;

UPDATE public.loans
  SET origination_rate = interest_rate
  WHERE origination_rate IS NULL;
