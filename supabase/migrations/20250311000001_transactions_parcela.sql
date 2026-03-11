-- Campos opcionais para identificar parcelas (ex.: 2/12, parcela 2 de 12).
alter table public.transactions
  add column if not exists parcela_numero smallint,
  add column if not exists parcela_total smallint;

comment on column public.transactions.parcela_numero is 'Número da parcela (ex.: 2 em 2/12)';
comment on column public.transactions.parcela_total is 'Total de parcelas (ex.: 12 em 2/12)';
