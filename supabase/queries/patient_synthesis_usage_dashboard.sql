-- Consultas uteis para acompanhar o uso mensal da Sintese IA por psicologo.
-- Rode no Supabase SQL Editor quando quiser conferir limite, uso e detalhes.
-- Limites alinhados com src/config/plans.ts:
-- free: 0, basic: 0, pro: 10, ultra: 50.

-- 1) Resumo do mes atual por psicologo.
-- Mostra plano, limite, uso, restantes e status do limite.
with usage as (
  select
    psychologist_id,
    count(*) as used_this_month
  from patient_ai_analyses
  where status = 'completed'
    and completed_at >= date_trunc('month', now())
    and completed_at < date_trunc('month', now()) + interval '1 month'
    and result_json @> '{"type":"synthesis"}'::jsonb
  group by psychologist_id
),
plan_limits as (
  select *
  from (
    values
      ('free', 0),
      ('basic', 0),
      ('pro', 10),
      ('ultra', 50)
  ) as t(subscription_tier, monthly_synthesis_limit)
)
select
  p.id as psychologist_id,
  p.full_name,
  au.email,
  coalesce(p.subscription_tier, 'free') as subscription_tier,
  coalesce(u.used_this_month, 0) as used_this_month,
  coalesce(pl.monthly_synthesis_limit, 0) as monthly_synthesis_limit,
  greatest(
    coalesce(pl.monthly_synthesis_limit, 0) - coalesce(u.used_this_month, 0),
    0
  ) as remaining_this_month,
  case
    when coalesce(pl.monthly_synthesis_limit, 0) = 0 then 'sem acesso'
    when coalesce(u.used_this_month, 0) >= coalesce(pl.monthly_synthesis_limit, 0) then 'limite atingido'
    else 'disponivel'
  end as limit_status
from profiles p
left join auth.users au on au.id = p.id
left join usage u on u.psychologist_id = p.id
left join plan_limits pl on pl.subscription_tier = coalesce(p.subscription_tier, 'free')
where coalesce(u.used_this_month, 0) > 0
   or coalesce(p.subscription_tier, 'free') in ('pro', 'ultra')
order by used_this_month desc, p.full_name;

-- 2) Apenas psicologos que ja atingiram ou passaram do limite do mes.
with usage as (
  select
    psychologist_id,
    count(*) as used_this_month
  from patient_ai_analyses
  where status = 'completed'
    and completed_at >= date_trunc('month', now())
    and completed_at < date_trunc('month', now()) + interval '1 month'
    and result_json @> '{"type":"synthesis"}'::jsonb
  group by psychologist_id
),
plan_limits as (
  select *
  from (
    values
      ('free', 0),
      ('basic', 0),
      ('pro', 10),
      ('ultra', 50)
  ) as t(subscription_tier, monthly_synthesis_limit)
)
select
  p.id as psychologist_id,
  p.full_name,
  au.email,
  coalesce(p.subscription_tier, 'free') as subscription_tier,
  u.used_this_month,
  pl.monthly_synthesis_limit
from profiles p
left join auth.users au on au.id = p.id
join usage u on u.psychologist_id = p.id
join plan_limits pl on pl.subscription_tier = coalesce(p.subscription_tier, 'free')
where pl.monthly_synthesis_limit > 0
  and u.used_this_month >= pl.monthly_synthesis_limit
order by u.used_this_month desc, p.full_name;

-- 3) Detalhe das sinteses feitas no mes atual, com dados do psicologo e paciente.
-- Use esta para auditar quais sinteses compoem o contador do front.
with plan_limits as (
  select *
  from (
    values
      ('free', 0),
      ('basic', 0),
      ('pro', 10),
      ('ultra', 50)
  ) as t(subscription_tier, monthly_synthesis_limit)
),
monthly_usage as (
  select
    psychologist_id,
    count(*) as used_this_month
  from patient_ai_analyses
  where status = 'completed'
    and completed_at >= date_trunc('month', now())
    and completed_at < date_trunc('month', now()) + interval '1 month'
    and result_json @> '{"type":"synthesis"}'::jsonb
  group by psychologist_id
)
select
  a.id as synthesis_id,
  a.psychologist_id,
  psychologist.full_name as psychologist_name,
  au.email as psychologist_email,
  coalesce(psychologist.subscription_tier, 'free') as subscription_tier,
  coalesce(u.used_this_month, 0) as used_this_month,
  coalesce(pl.monthly_synthesis_limit, 0) as monthly_synthesis_limit,
  a.patient_id,
  patient.full_name as patient_name,
  a.completed_at,
  coalesce(nullif(a.result_json ->> 'sessions_analyzed', '')::int, 0) as sessions_analyzed,
  left(coalesce(a.summary_text, a.result_json ->> 'summary', ''), 240) as summary_preview
from patient_ai_analyses a
left join profiles psychologist on psychologist.id = a.psychologist_id
left join auth.users au on au.id = a.psychologist_id
left join patients patient on patient.id = a.patient_id
left join monthly_usage u on u.psychologist_id = a.psychologist_id
left join plan_limits pl on pl.subscription_tier = coalesce(psychologist.subscription_tier, 'free')
where a.status = 'completed'
  and a.completed_at >= date_trunc('month', now())
  and a.completed_at < date_trunc('month', now()) + interval '1 month'
  and a.result_json @> '{"type":"synthesis"}'::jsonb
order by a.completed_at desc;

-- 4) Detalhe das sinteses de um psicologo especifico no mes atual.
-- Troque o UUID abaixo pelo psychologist_id desejado.
select
  a.id as synthesis_id,
  a.patient_id,
  p.full_name as patient_name,
  a.completed_at,
  coalesce(nullif(a.result_json ->> 'sessions_analyzed', '')::int, 0) as sessions_analyzed,
  left(coalesce(a.summary_text, a.result_json ->> 'summary', ''), 240) as summary_preview
from patient_ai_analyses a
left join patients p on p.id = a.patient_id
where a.psychologist_id = '00000000-0000-0000-0000-000000000000'
  and a.status = 'completed'
  and a.completed_at >= date_trunc('month', now())
  and a.completed_at < date_trunc('month', now()) + interval '1 month'
  and a.result_json @> '{"type":"synthesis"}'::jsonb
order by a.completed_at desc;
