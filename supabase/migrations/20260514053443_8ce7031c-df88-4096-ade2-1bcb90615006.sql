ALTER TABLE public.player_properties ADD COLUMN IF NOT EXISTS last_eviction_reason text;
ALTER TABLE public.player_properties ADD COLUMN IF NOT EXISTS last_eviction_at timestamptz;