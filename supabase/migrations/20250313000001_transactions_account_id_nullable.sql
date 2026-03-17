-- Permite transações sem conta vinculada (account_id opcional)
alter table public.transactions
  alter column account_id drop not null;

comment on column public.transactions.account_id is 'Conta vinculada (opcional). Quando null, a transação não está vinculada a uma conta.';
