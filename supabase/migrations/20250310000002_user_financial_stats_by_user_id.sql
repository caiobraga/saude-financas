-- Recalcula receitas/despesas por user_id diretamente em transactions (usa coluna transactions.user_id).
-- Garante que o admin veja valores corretos por usuário.

create or replace view public.user_financial_stats
with (security_invoker = on)
as
select
  t.user_id,
  coalesce(sum(case when t.type = 'credit' then t.amount else 0 end), 0)::numeric(14, 2) as receitas,
  abs(coalesce(sum(case when t.type = 'debit' then t.amount else 0 end), 0))::numeric(14, 2) as despesas
from public.transactions t
group by t.user_id;
