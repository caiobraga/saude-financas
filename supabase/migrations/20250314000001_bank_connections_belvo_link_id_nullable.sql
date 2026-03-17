-- belvo_link_id só é necessário para conexões Belvo; conexões de importação PDF (legado) ou futuras fontes podem ser null.
alter table public.bank_connections
  alter column belvo_link_id drop not null;

-- Índice único (user_id, belvo_link_id) continua: múltiplas linhas com belvo_link_id null são permitidas por usuário.
-- Nenhuma alteração na constraint unique necessária.
