-- Quando account_id for null, definir user_id como o usuário autenticado (para RLS e transações sem conta)
create or replace function public.set_transactions_user_id()
returns trigger as $$
begin
  if new.account_id is null then
    new.user_id := auth.uid();
  else
    select a.user_id into new.user_id
    from public.accounts a
    where a.id = new.account_id
    limit 1;
  end if;
  return new;
end;
$$ language plpgsql security definer;
