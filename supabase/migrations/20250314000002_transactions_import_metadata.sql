-- Metadados de importação para preservar ordem do PDF e permitir filtros por lote.
alter table public.transactions
  add column if not exists import_source text,
  add column if not exists import_batch_id text,
  add column if not exists import_order integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_import_source_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_import_source_check
      check (import_source is null or import_source in ('pdf', 'manual'));
  end if;
end $$;

create index if not exists idx_transactions_import_source on public.transactions (import_source);
create index if not exists idx_transactions_import_batch_id on public.transactions (import_batch_id);
