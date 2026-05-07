-- Consultas úteis para acompanhar repasses financeiros.
-- Rode no Supabase SQL Editor quando quiser investigar o estado dos repasses.

-- 1) Cobranças pagas que ainda não foram repassadas.
select
  id,
  psychologist_id,
  amount,
  billing_type,
  paid_at,
  transferred_at,
  transfer_id,
  asaas_payment_id
from financial_charges
where status = 'paid'
  and transferred_at is null
  and asaas_payment_id is not null
  and paid_at is not null
order by paid_at asc;

-- 2) Cobranças já elegíveis para repasse agora, respeitando liquidação.
-- Ajuste os intervalos se SETTLEMENT_DAYS mudar no código.
select
  id,
  psychologist_id,
  amount,
  billing_type,
  paid_at,
  case
    when coalesce(billing_type, 'PIX') = 'PIX'
      then paid_at + interval '0 days'
    when coalesce(billing_type, 'PIX') = 'BOLETO'
      then paid_at + interval '1 day'
    else paid_at + interval '0 days'
  end as available_at,
  transferred_at,
  transfer_id,
  asaas_payment_id
from financial_charges
where status = 'paid'
  and transferred_at is null
  and asaas_payment_id is not null
  and paid_at is not null
  and (
    case
      when coalesce(billing_type, 'PIX') = 'PIX'
        then paid_at + interval '0 days'
      when coalesce(billing_type, 'PIX') = 'BOLETO'
        then paid_at + interval '1 day'
      else paid_at + interval '0 days'
    end
  ) <= now()
order by paid_at asc;

-- 3) Repasses já realizados.
-- Versão compatível mesmo se a coluna transfer_amount ainda não existir.
select
  id,
  psychologist_id,
  amount,
  billing_type,
  paid_at,
  transferred_at,
  transfer_id
from financial_charges
where transferred_at is not null
order by transferred_at desc;

-- 4) Resumo por psicólogo: pendente x repassado.
select
  psychologist_id,
  count(*) filter (
    where status = 'paid'
      and transferred_at is null
      and asaas_payment_id is not null
      and paid_at is not null
  ) as pending_transfer_count,
  coalesce(sum(amount) filter (
    where status = 'paid'
      and transferred_at is null
      and asaas_payment_id is not null
      and paid_at is not null
  ), 0) as pending_transfer_gross_amount,
  count(*) filter (
    where transferred_at is not null
  ) as transferred_count,
  coalesce(sum(amount) filter (
    where transferred_at is not null
  ), 0) as transferred_gross_amount
from financial_charges
group by psychologist_id
order by pending_transfer_gross_amount desc;

-- 5) Histórico recente de execuções do cron Supabase, se pg_cron estiver habilitado.
select
  jobid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
from cron.job_run_details
order by start_time desc
limit 20;
