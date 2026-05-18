ALTER TABLE financial_charges
  ADD COLUMN IF NOT EXISTS transfer_amount numeric(10,2);
