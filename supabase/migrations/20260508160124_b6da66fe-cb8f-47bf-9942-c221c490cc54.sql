
ALTER TABLE public.achievements
  ADD CONSTRAINT achievements_player_badge_unique UNIQUE (player_id, badge_key);

CREATE TABLE public.leaderboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  rank integer NOT NULL,
  player_id uuid NOT NULL,
  display_name text,
  properties_count integer NOT NULL DEFAULT 0,
  net_worth numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX leaderboard_snapshots_latest_idx
  ON public.leaderboard_snapshots (snapshot_date DESC, rank ASC);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard readable by signed-in users"
  ON public.leaderboard_snapshots
  FOR SELECT
  TO authenticated
  USING (true);
