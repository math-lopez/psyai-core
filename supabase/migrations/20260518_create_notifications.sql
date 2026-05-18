-- Tabela de notificações persistentes para o psicólogo
CREATE TABLE IF NOT EXISTS public.notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL CHECK (type IN ('success', 'error', 'info', 'warning')),
  event_type      TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  message         TEXT        NOT NULL,
  href            TEXT,
  read            BOOLEAN     NOT NULL DEFAULT false,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_psychologist_created
  ON public.notifications(psychologist_id, created_at DESC);

-- Unique para evitar duplicatas de notificações de "sessão em breve"
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_session_starting_once
  ON public.notifications(psychologist_id, event_type, (metadata->>'session_id'))
  WHERE event_type = 'session_starting_soon';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Psychologist can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = psychologist_id);

CREATE POLICY "Psychologist can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = psychologist_id);

CREATE POLICY "Psychologist can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = psychologist_id);

-- Realtime: habilitar publicação na tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
