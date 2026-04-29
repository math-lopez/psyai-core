-- Valor de sessão por paciente (opcional, sobrescreve o padrão das configurações)
alter table public.patients
  add column if not exists session_value numeric(10, 2);

-- Vínculo de sessão com cobrança (para saber quais sessões já foram cobradas)
alter table public.sessions
  add column if not exists charge_id uuid references public.financial_charges(id) on delete set null;

create index if not exists sessions_charge_id_idx on public.sessions (charge_id);
