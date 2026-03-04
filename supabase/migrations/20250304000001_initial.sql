-- Saúde Finanças: schema inicial
-- Rode no SQL Editor do Supabase (Dashboard > SQL Editor) ou via Supabase CLI.

-- Perfis (estende auth.users; opcional se usar apenas auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Conexões bancárias (Belvo link)
create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  belvo_link_id text not null,
  institution text not null,
  status text not null default 'active' check (status in ('active', 'error', 'pending')),
  connected_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, belvo_link_id)
);

-- Contas (por conexão)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.bank_connections (id) on delete cascade,
  external_id text not null,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'credit')),
  balance numeric(14, 2) not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (connection_id, external_id)
);

-- Transações (por conta)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  external_id text,
  date date not null,
  description text not null,
  raw_description text,
  amount numeric(14, 2) not null,
  type text not null check (type in ('credit', 'debit')),
  category text,
  created_at timestamptz default now(),
  unique (account_id, external_id)
);

-- Assinaturas Stripe (plano Pro)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  status text not null default 'inactive' check (status in ('active', 'canceled', 'inactive', 'past_due')),
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id)
);

-- Índices
create index if not exists idx_bank_connections_user_id on public.bank_connections (user_id);
create index if not exists idx_accounts_connection_id on public.accounts (connection_id);
create index if not exists idx_transactions_account_id on public.transactions (account_id);
create index if not exists idx_transactions_date on public.transactions (date);
create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);

-- RLS (Row Level Security)
alter table public.profiles enable row level security;
alter table public.bank_connections enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.subscriptions enable row level security;

-- Políticas: usuário só acessa seus dados
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can manage own bank_connections"
  on public.bank_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read accounts from own connections"
  on public.accounts for select
  using (
    exists (
      select 1 from public.bank_connections bc
      where bc.id = accounts.connection_id and bc.user_id = auth.uid()
    )
  );

create policy "Users can read transactions from own accounts"
  on public.transactions for select
  using (
    exists (
      select 1 from public.accounts a
      join public.bank_connections bc on bc.id = a.connection_id
      where a.id = transactions.account_id and bc.user_id = auth.uid()
    )
  );

create policy "Users can manage own subscriptions"
  on public.subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger: criar profile ao criar user (se usar Supabase Auth)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.raw_user_meta_data->>'email',
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
