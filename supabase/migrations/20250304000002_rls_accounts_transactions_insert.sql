-- Permite que o usuário (via backend com sua sessão) insira/atualize contas e transações
-- quando a conexão ou conta pertence a ele.

create policy "Users can insert accounts for own connections"
  on public.accounts for insert
  with check (
    exists (
      select 1 from public.bank_connections bc
      where bc.id = connection_id and bc.user_id = auth.uid()
    )
  );

create policy "Users can update accounts for own connections"
  on public.accounts for update
  using (
    exists (
      select 1 from public.bank_connections bc
      where bc.id = accounts.connection_id and bc.user_id = auth.uid()
    )
  );

create policy "Users can insert transactions for own accounts"
  on public.transactions for insert
  with check (
    exists (
      select 1 from public.accounts a
      join public.bank_connections bc on bc.id = a.connection_id
      where a.id = account_id and bc.user_id = auth.uid()
    )
  );

create policy "Users can update transactions for own accounts"
  on public.transactions for update
  using (
    exists (
      select 1 from public.accounts a
      join public.bank_connections bc on bc.id = a.connection_id
      where a.id = transactions.account_id and bc.user_id = auth.uid()
    )
  );
