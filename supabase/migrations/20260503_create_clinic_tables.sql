-- ============================================================
-- MIGRATION: Suporte a clínicas (multi-tenancy)
--
-- Adiciona as tabelas clinics e clinic_members para permitir
-- que uma clínica compre um plano e cadastre múltiplos
-- psicólogos, cada um com seu próprio acesso ao sistema.
--
-- O fluxo solo existente (psicólogo individual) não é afetado.
-- ============================================================

-- Tabela principal da clínica
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete restrict,
  subscription_tier text not null default 'clinic_starter'
    check (subscription_tier in ('clinic_starter', 'clinic_pro', 'clinic_enterprise')),
  subscription_status text not null default 'active'
    check (subscription_status in ('active', 'suspended', 'cancelled')),
  asaas_customer_id text,
  asaas_api_key text,
  cnpj text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.clinics (owner_id);

alter table public.clinics enable row level security;

-- Admin da clínica vê e edita os dados dela
create policy "clinic owner manages clinic"
  on public.clinics for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Membros da clínica podem ler os dados dela
create policy "clinic members can read clinic"
  on public.clinics for select
  using (
    exists (
      select 1 from public.clinic_members cm
      where cm.clinic_id = id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

-- ============================================================
-- Membros da clínica (psicólogos vinculados)
-- ============================================================

create table public.clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'psychologist'
    check (role in ('admin', 'psychologist')),
  status text not null default 'active'
    check (status in ('active', 'invited', 'suspended')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz,
  accepted_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create index on public.clinic_members (clinic_id, status);
create index on public.clinic_members (user_id);

alter table public.clinic_members enable row level security;

-- Admin da clínica gerencia membros
create policy "clinic owner manages members"
  on public.clinic_members for all
  using (
    exists (
      select 1 from public.clinics c
      where c.id = clinic_id
        and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clinics c
      where c.id = clinic_id
        and c.owner_id = auth.uid()
    )
  );

-- Admin membro (role=admin) também gerencia membros
create policy "clinic admin member manages members"
  on public.clinic_members for all
  using (
    exists (
      select 1 from public.clinic_members cm
      where cm.clinic_id = clinic_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
        and cm.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.clinic_members cm
      where cm.clinic_id = clinic_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
        and cm.status = 'active'
    )
  );

-- Cada membro vê o próprio registro
create policy "member reads own record"
  on public.clinic_members for select
  using (user_id = auth.uid());

-- ============================================================
-- Função helper: retorna o clinic_id do usuário logado
-- Usada internamente para enriquecer contexto de auth.
-- ============================================================

create or replace function public.get_user_clinic_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
as $$
  select clinic_id
  from public.clinic_members
  where user_id = p_user_id
    and status = 'active'
  limit 1;
$$;

-- ============================================================
-- Função helper: retorna o role do usuário numa clínica
-- ============================================================

create or replace function public.get_user_clinic_role(p_user_id uuid, p_clinic_id uuid)
returns text
language sql
stable
security definer
as $$
  select role
  from public.clinic_members
  where user_id = p_user_id
    and clinic_id = p_clinic_id
    and status = 'active'
  limit 1;
$$;
