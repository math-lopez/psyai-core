-- Migra para modelo agregador: pagamentos centralizados na conta master Asaas
-- Remove API key por psicólogo (não mais necessária)
ALTER TABLE profiles DROP COLUMN IF EXISTS asaas_api_key;

-- Limpa customer IDs antigos (eram da subconta, agora serão da conta master)
UPDATE patients SET asaas_customer_id = NULL WHERE asaas_customer_id IS NOT NULL;

-- Adiciona rastreamento de método de cobrança e repasse em financial_charges
ALTER TABLE financial_charges
  ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'PIX'
    CHECK (billing_type IN ('PIX', 'BOLETO', 'UNDEFINED')),
  ADD COLUMN IF NOT EXISTS transfer_id      TEXT,
  ADD COLUMN IF NOT EXISTS transferred_at   TIMESTAMPTZ;

-- Marca cobranças já pagas antes desta migration como transferidas
-- para o job de repasse não tentar reprocessar pagamentos do modelo antigo
UPDATE financial_charges
  SET transferred_at = NOW()
  WHERE status = 'paid' AND transferred_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_charges_pending_transfer
  ON public.financial_charges (psychologist_id, paid_at)
  WHERE status = 'paid' AND transferred_at IS NULL AND asaas_payment_id IS NOT NULL;
