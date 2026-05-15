-- Permite 'appointment' como processing_status inicial de agendamentos
-- Sessões criadas pela agenda ficam como 'appointment' até o psicólogo iniciar o atendimento

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_processing_status_check;

ALTER TABLE sessions ADD CONSTRAINT sessions_processing_status_check
CHECK (processing_status IN ('appointment', 'draft', 'queued', 'processing', 'completed', 'failed', 'error', 'cancelled'));
