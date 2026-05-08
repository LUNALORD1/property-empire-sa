-- Public bucket for property hero photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy
DO $$ BEGIN
  CREATE POLICY "Property photos are publicly readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'property-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;