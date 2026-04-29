create table public.patient_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  psychologist_id uuid not null,
  status text not null default 'requested',
  result_json jsonb,
  summary_text text,
  requested_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.patient_ai_analyses (patient_id, psychologist_id, created_at desc);

alter table public.patient_ai_analyses enable row level security;

create policy "psychologist can manage own analyses"
  on public.patient_ai_analyses
  for all
  using (psychologist_id = auth.uid())
  with check (psychologist_id = auth.uid());
