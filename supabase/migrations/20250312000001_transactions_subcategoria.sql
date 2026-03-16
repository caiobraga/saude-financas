-- Subcategoria fixa por transação (Casa, Saúde, Empresa, etc.)
alter table public.transactions
  add column if not exists subcategoria text;

comment on column public.transactions.subcategoria is 'Subcategoria fixa: Casa, Saúde, Empresa, Consórcio, Assinaturas mensais, Variáveis, Igreja';
