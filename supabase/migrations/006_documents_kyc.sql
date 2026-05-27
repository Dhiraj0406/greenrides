-- Phase 2: KYC document infrastructure.

-- Enums (guard with DO blocks for idempotency)
DO $$ BEGIN CREATE TYPE "KycStatus" AS ENUM ('NOT_SUBMITTED','SUBMITTED','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "DocumentEntityType" AS ENUM ('DRIVER','VEHICLE','OWNER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "DocumentStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Document table
CREATE TABLE IF NOT EXISTS "Document" (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  "DocumentEntityType" NOT NULL,
  entity_id    TEXT           NOT NULL,
  doc_type     TEXT           NOT NULL,
  storage_path TEXT           NOT NULL,
  status       "DocumentStatus" NOT NULL DEFAULT 'PENDING',
  verified_by  TEXT,
  verified_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Document_entity_idx" ON "Document" (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS "Document_status_idx" ON "Document" (status);

ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;

-- Drivers/owners can read their own documents (service role handles writes)
CREATE POLICY IF NOT EXISTS "document_owner_read" ON "Document"
  FOR SELECT USING (auth.uid()::text = entity_id);

-- kyc_status on DriverProfile
ALTER TABLE "DriverProfile"
  ADD COLUMN IF NOT EXISTS kyc_status "KycStatus" NOT NULL DEFAULT 'NOT_SUBMITTED';

-- Storage bucket (run via Supabase CLI if this fails: supabase storage create kyc-documents)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Seed kyc feature flag
INSERT INTO public.app_remote_config (key, value_json, module_scope, enabled)
VALUES (
  'kyc.require_for_dispatch',
  '{"description": "Skip unverified drivers from dispatch queue"}',
  'RIDESHARING',
  false
)
ON CONFLICT (key) DO NOTHING;
