-- Phase 4: Role change audit log.

CREATE TABLE IF NOT EXISTS "UserRoleHistory" (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL,
  old_role   TEXT        NOT NULL,
  new_role   TEXT        NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS "UserRoleHistory_user_idx" ON "UserRoleHistory" (user_id);

ALTER TABLE "UserRoleHistory" ENABLE ROW LEVEL SECURITY;

-- Service role handles all writes; admins query via service role client
CREATE POLICY IF NOT EXISTS "role_history_admin_read" ON "UserRoleHistory"
  FOR SELECT USING (false);
