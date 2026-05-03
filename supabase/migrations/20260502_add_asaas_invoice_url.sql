ALTER TABLE financial_charges
  ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT;
