-- Instrumentos/protocolos criados pelo psicólogo
CREATE TABLE IF NOT EXISTS test_templates (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  description       TEXT,
  instructions      TEXT,
  scoring_config    JSONB       NOT NULL DEFAULT '{"type":"sum"}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Itens/perguntas dentro de um instrumento
CREATE TABLE IF NOT EXISTS test_questions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID        NOT NULL REFERENCES test_templates(id) ON DELETE CASCADE,
  order_index  INTEGER     NOT NULL,
  text         TEXT        NOT NULL,
  type         TEXT        NOT NULL CHECK (type IN ('likert', 'yes_no')),
  options      JSONB       NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aplicação de um instrumento para um paciente específico
CREATE TABLE IF NOT EXISTS test_applications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      UUID        NOT NULL REFERENCES test_templates(id),
  patient_id       UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  psychologist_id  UUID        NOT NULL REFERENCES profiles(id),
  session_id       UUID        REFERENCES sessions(id) ON DELETE SET NULL,
  token            TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  completed_at     TIMESTAMPTZ,
  result           JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Respostas do paciente por item
CREATE TABLE IF NOT EXISTS test_responses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID        NOT NULL REFERENCES test_applications(id) ON DELETE CASCADE,
  question_id     UUID        NOT NULL REFERENCES test_questions(id),
  answer          JSONB       NOT NULL,
  score           NUMERIC,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE test_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_responses     ENABLE ROW LEVEL SECURITY;
