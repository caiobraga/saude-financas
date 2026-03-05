-- Permite que o usuário exclua contas que pertencem às suas conexões.
-- As transações da conta são removidas em cascata (on delete cascade).

create policy "Users can delete accounts for own connections"
  on public.accounts for delete
  using (
    exists (
      select 1 from public.bank_connections bc
      where bc.id = accounts.connection_id and bc.user_id = auth.uid()
    )
  );
