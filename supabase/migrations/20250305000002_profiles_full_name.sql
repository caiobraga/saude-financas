-- Garante coluna full_name em profiles (schema cache / DB sem migração inicial completa)
alter table public.profiles
  add column if not exists full_name text;
