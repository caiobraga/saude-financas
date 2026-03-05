-- Permite que o usuário exclua transações das próprias contas
create policy "Users can delete transactions for own accounts"
  on public.transactions for delete
  using (
    exists (
      select 1 from public.accounts a
      join public.bank_connections bc on bc.id = a.connection_id
      where a.id = transactions.account_id and bc.user_id = auth.uid()
    )
  );
