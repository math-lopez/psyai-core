create table public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references auth.users(id) on delete cascade,
  instance_name text not null,
  connected boolean not null default false,
  phone text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (psychologist_id),
  unique (instance_name)
);

alter table public.whatsapp_instances enable row level security;

create policy "psychologist manages own whatsapp instance"
  on public.whatsapp_instances for all
  using (psychologist_id = auth.uid())
  with check (psychologist_id = auth.uid());

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  type text not null,
  sent_at timestamptz not null default now()
);

create index on public.notification_logs (session_id, type);

-- notification_logs é escrita apenas pelo backend (service role), sem RLS
