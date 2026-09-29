-- P0-101: Identity foundation — enums, profiles, triggers, RLS.
-- Prinsip database.md: UUID PK, FK, UTC, RLS di tabel terekspos.
-- Kebijakan INSERT profil: hanya via trigger handle_new_user (definer).
-- Proteksi kolom status menyusul di P0-104 (butuh has_permission).

-- 1. Enum closed-set
do $$ begin
  create type account_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type scope_type as enum ('GLOBAL', 'ORGANIZATION', 'DIVISION', 'CLASS', 'COURSE', 'OWN');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type entity_status as enum ('ACTIVE', 'INACTIVE', 'ARCHIVED');
exception when duplicate_object then null;
end $$;

-- 2. Tabel profiles (id = auth.users.id)
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  username text unique,
  student_number text unique,
  avatar_path text,
  phone text,
  status account_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Trigger updated_at generik
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- 4. Auto-profil saat user auth dibuat (definer: bypass RLS by design)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, avatar_path)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 5. RLS: baca/ubah profil sendiri. Tanpa policy INSERT/DELETE.
alter table profiles enable row level security;

drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 6. Grants eksplisit (tanpa grant, policy tidak pernah dievaluasi)
grant select, update on profiles to authenticated;
grant all on profiles to service_role;
