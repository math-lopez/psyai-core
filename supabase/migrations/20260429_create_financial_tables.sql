create table public.financial_settings (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references auth.users(id) on delete cascade,
  pix_key text not null,
  pix_key_type text not null check (pix_key_type in ('cpf', 'email', 'phone', 'random')),
  beneficiary_name text not null,
  default_session_value numeric(10, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (psychologist_id)
);

alter table public.financial_settings enable row level security;

create policy "psychologist manages own financial settings"
  on public.financial_settings for all
  using (psychologist_id = auth.uid())
  with check (psychologist_id = auth.uid());

create table public.financial_charges (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  amount numeric(10, 2) not null,
  description text,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.financial_charges (psychologist_id, status, due_date);
create index on public.financial_charges (patient_id);

alter table public.financial_charges enable row level security;

create policy "psychologist manages own charges"
  on public.financial_charges for all
  using (psychologist_id = auth.uid())
  with check (psychologist_id = auth.uid());
