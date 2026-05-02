-- Chave de API Asaas do psicólogo
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS asaas_api_key TEXT;

-- ID do cliente no Asaas (criado uma vez por paciente, por psicólogo)
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- ID do pagamento no Asaas (por cobrança)
ALTER TABLE financial_charges
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT;
