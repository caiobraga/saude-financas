-- Importação de fatura de cartão (PDF) e tipo de linha (compra vs resumo etc.)
alter table public.transactions
  drop constraint if exists transactions_import_source_check;

alter table public.transactions
  add constraint transactions_import_source_check
  check (import_source is null or import_source in ('pdf', 'manual', 'pdf_cartao'));

alter table public.transactions
  add column if not exists card_line_kind text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_card_line_kind_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_card_line_kind_check
      check (
        card_line_kind is null
        or card_line_kind in ('compra', 'resumo', 'pagamento', 'encargo', 'outro')
      );
  end if;
end $$;

create index if not exists idx_transactions_card_line_kind on public.transactions (card_line_kind);
