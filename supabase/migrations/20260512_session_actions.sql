-- Tokens para ações do paciente via email (confirm/absent/reschedule)
CREATE TABLE IF NOT EXISTS session_action_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  token      UUID        NOT NULL DEFAULT gen_random_uuid(),
  action     TEXT        NOT NULL CHECK (action IN ('confirm', 'absent', 'reschedule')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS session_action_tokens_token_idx      ON session_action_tokens(token);
CREATE        INDEX IF NOT EXISTS session_action_tokens_session_id_idx ON session_action_tokens(session_id);

-- Solicitações de reagendamento do paciente aguardando aprovação do psicólogo
CREATE TABLE IF NOT EXISTS session_reschedule_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  psychologist_id  UUID        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  new_session_date TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_reschedule_requests_session_id_idx      ON session_reschedule_requests(session_id);
CREATE INDEX IF NOT EXISTS session_reschedule_requests_psychologist_id_idx ON session_reschedule_requests(psychologist_id);
CREATE INDEX IF NOT EXISTS session_reschedule_requests_status_idx          ON session_reschedule_requests(status);

-- Status da resposta do paciente ao lembrete
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS patient_status TEXT DEFAULT 'pending'
    CHECK (patient_status IN ('pending', 'confirmed', 'absent', 'reschedule_requested'));
