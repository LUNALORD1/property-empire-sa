-- Add foreign keys so PostgREST can embed renter_type via renter_type_key
ALTER TABLE public.tenant_applicants
  ADD CONSTRAINT tenant_applicants_renter_type_key_fkey
  FOREIGN KEY (renter_type_key) REFERENCES public.renter_types(key) ON DELETE CASCADE;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_renter_type_key_fkey
  FOREIGN KEY (renter_type_key) REFERENCES public.renter_types(key) ON DELETE CASCADE;