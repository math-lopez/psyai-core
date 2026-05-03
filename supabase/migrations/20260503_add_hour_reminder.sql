ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS hour_reminder_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS hour_reminder_sent_at TIMESTAMPTZ;
