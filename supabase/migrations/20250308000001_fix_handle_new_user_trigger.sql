-- Fix: "Database error creating new user" when creating users via Admin API or invite.
-- 1) Trigger must use new.email (raw_user_meta_data can be empty for API-created users).
-- 2) RLS blocks the trigger because auth.uid() is null in trigger context; allow insert when id exists in auth.users and caller is not a regular user.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, cpf)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'email', new.email),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'cpf'
  );
  return new;
end;
$$;

-- Allow insert when auth.uid() = id (normal signup) OR when auth.uid() is null and the id exists in auth.users (trigger context)
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (
    auth.uid() = id
    or (auth.uid() is null and exists (select 1 from auth.users u where u.id = id))
  );
