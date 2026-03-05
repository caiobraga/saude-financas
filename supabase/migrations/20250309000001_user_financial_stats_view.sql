-- View que agrega receitas e despesas por user_id (a partir de bank_connections -> accounts -> transactions).
-- No app: credit = amount positivo, debit = amount negativo. Receitas = soma dos créditos (positivos),
-- Despesas = valor absoluto da soma dos débitos (negativos), para exibir como número positivo.
-- Com security_invoker = on, o RLS das tabelas base é aplicado; service_role (admin) vê todas as linhas.

create or replace view public.user_financial_stats
with (security_invoker = on)
as
select
  bc.user_id,
  coalesce(sum(case when t.type = 'credit' then t.amount else 0 end), 0)::numeric(14, 2) as receitas,
  abs(coalesce(sum(case when t.type = 'debit' then t.amount else 0 end), 0))::numeric(14, 2) as despesas
from public.bank_connections bc
join public.accounts a on a.connection_id = bc.id
join public.transactions t on t.account_id = a.id
group by bc.user_id;

-- Só authenticated e service_role podem ler a view. anon não.
revoke all on public.user_financial_stats from anon;
grant select on public.user_financial_stats to authenticated;
grant select on public.user_financial_stats to service_role;
