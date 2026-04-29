alter table public.whatsapp_instances
  add column if not exists qr_code text,
  add column if not exists qr_updated_at timestamptz;
