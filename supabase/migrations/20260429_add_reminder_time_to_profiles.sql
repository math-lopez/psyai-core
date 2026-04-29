-- Hora do lembrete em Brasília (0-23). Default: 8h.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reminder_time INTEGER NOT NULL DEFAULT 8;
