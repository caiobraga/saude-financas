-- Adiciona user_id em accounts e transactions para consultas e RLS diretas por usuário.
-- O user_id é derivado de bank_connections (accounts) e de accounts (transactions).
-- Triggers mantêm user_id em sincronia em inserts/updates.

-- 1) Coluna user_id em accounts
alter table public.accounts
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

update public.accounts
set user_id = bc.user_id
from public.bank_connections bc
where bc.id = accounts.connection_id
  and accounts.user_id is null;

alter table public.accounts
  alter column user_id set not null;

create index if not exists idx_accounts_user_id on public.accounts (user_id);

-- Trigger: manter accounts.user_id em sincronia com bank_connections
create or replace function public.set_accounts_user_id()
returns trigger as $$
begin
  select bc.user_id into new.user_id
  from public.bank_connections bc
  where bc.id = new.connection_id
  limit 1;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists set_accounts_user_id_trigger on public.accounts;
create trigger set_accounts_user_id_trigger
  before insert or update on public.accounts
  for each row execute function public.set_accounts_user_id();

-- 2) Coluna user_id em transactions
alter table public.transactions
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

update public.transactions
set user_id = a.user_id
from public.accounts a
where a.id = transactions.account_id
  and transactions.user_id is null;

alter table public.transactions
  alter column user_id set not null;

create index if not exists idx_transactions_user_id on public.transactions (user_id);

-- Trigger: manter transactions.user_id em sincronia com accounts
create or replace function public.set_transactions_user_id()
returns trigger as $$
begin
  select a.user_id into new.user_id
  from public.accounts a
  where a.id = new.account_id
  limit 1;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists set_transactions_user_id_trigger on public.transactions;
create trigger set_transactions_user_id_trigger
  before insert or update on public.transactions
  for each row execute function public.set_transactions_user_id();

-- 3) RLS: políticas de accounts usando user_id
drop policy if exists "Users can read accounts from own connections" on public.accounts;
drop policy if exists "Users can insert accounts for own connections" on public.accounts;
drop policy if exists "Users can update accounts for own connections" on public.accounts;
drop policy if exists "Users can delete accounts for own connections" on public.accounts;

create policy "Users can read own accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert own accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own accounts"
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own accounts"
  on public.accounts for delete
  using (auth.uid() = user_id);

-- 4) RLS: políticas de transactions usando user_id
drop policy if exists "Users can read transactions from own accounts" on public.transactions;
drop policy if exists "Users can insert transactions for own accounts" on public.transactions;
drop policy if exists "Users can update transactions for own accounts" on public.transactions;
drop policy if exists "Users can delete transactions for own accounts" on public.transactions;

create policy "Users can read own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);
