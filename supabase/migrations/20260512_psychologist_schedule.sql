-- Agenda de trabalho do psicólogo (dias e horários disponíveis para reagendamento automático)
CREATE TABLE IF NOT EXISTS psychologist_schedule (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id  UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week      INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=domingo ... 6=sábado
  start_time       TEXT    NOT NULL, -- "09:00"
  end_time         TEXT    NOT NULL, -- "18:00"
  UNIQUE (psychologist_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS psychologist_schedule_psychologist_id_idx ON psychologist_schedule(psychologist_id);

-- Modo de reagendamento: manual (psicólogo contata paciente) ou automático (paciente escolhe slot)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reschedule_mode TEXT DEFAULT 'manual'
    CHECK (reschedule_mode IN ('manual', 'automatic'));
