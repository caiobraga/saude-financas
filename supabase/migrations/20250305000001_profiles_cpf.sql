-- Adiciona CPF ao perfil (necessário para o widget Belvo Brasil)
alter table public.profiles
  add column if not exists cpf text;

-- Atualiza o trigger para preencher cpf ao criar usuário
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, cpf)
  values (
    new.id,
    new.raw_user_meta_data->>'email',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'cpf'
  );
  return new;
end;
$$ language plpgsql security definer;
