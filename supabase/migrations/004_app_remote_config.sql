-- Remote feature flags table for the Super-App platform layer.
-- Reads are public (anon). Writes are service-role only (bypasses RLS by default).

CREATE TABLE IF NOT EXISTS public.app_remote_config (
  key          TEXT        PRIMARY KEY,
  value_json   JSONB       NOT NULL DEFAULT '{}',
  module_scope TEXT        NOT NULL,
  enabled      BOOLEAN     NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_remote_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "remote_config_anon_read" ON public.app_remote_config
  FOR SELECT USING (true);

-- Seed initial flags (idempotent)
INSERT INTO public.app_remote_config (key, value_json, module_scope, enabled) VALUES
  (
    'dispatch.telegram_cascade',
    '{"description": "Send Telegram notifications in driver dispatch queue"}',
    'RIDESHARING',
    true
  ),
  (
    'dispatch.in_app_accept',
    '{"description": "Enable in-app accept/reject flow for drivers (Phase 1)"}',
    'RIDESHARING',
    false
  ),
  (
    'payments.razorpay_enabled',
    '{"description": "Enable Razorpay payment gateway"}',
    'RIDESHARING',
    false
  )
ON CONFLICT (key) DO NOTHING;
