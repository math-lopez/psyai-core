ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_enabled BOOLEAN NOT NULL DEFAULT false;
