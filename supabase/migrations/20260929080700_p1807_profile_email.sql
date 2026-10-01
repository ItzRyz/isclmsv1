-- P1-807: email profil untuk notifikasi Sender.
-- Backfill dari auth.users (hak postgres migrasi); trigger menjaga sinkron.
alter table profiles add column if not exists email text;

update profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null and u.email is not null;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, avatar_path, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email
  )
  on conflict (id) do update set
    email = coalesce(profiles.email, excluded.email);
  return new;
end;
$$;
