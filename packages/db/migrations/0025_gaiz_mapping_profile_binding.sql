-- GAIZ2 immutable mapping binding; DRAFT / UNAPPLIED.
-- Bind every authorization to the same-tenant, same-kind mapping profile.
ALTER TABLE public.gaiz_mapping_profiles
  ADD CONSTRAINT gaiz_mapping_profiles_tenant_profile_kind_unique
  UNIQUE (tenant_id,profile_id,target_kind);
ALTER TABLE public.gaiz_import_authorizations
  ADD CONSTRAINT gaiz_import_auth_mapping_profile_fk
  FOREIGN KEY (tenant_id,mapping_profile_id,target_kind)
  REFERENCES public.gaiz_mapping_profiles (tenant_id,profile_id,target_kind)
  ON DELETE RESTRICT;
-- Review status is checked again by the read-only commit gate.
-- A foreign key cannot itself prove business approval or freshness.
