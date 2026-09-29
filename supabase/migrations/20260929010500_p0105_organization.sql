-- P0-105: Organization scope — organizations, divisions, user_divisions.
-- Seed: 1 organisasi + 3 divisi (UIUX/WEB/ML) agar scope koordinator teruji.
-- Keanggotaan aktif = ended_at null.

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists organizations_updated_at on organizations;
create trigger organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create table if not exists divisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  code text unique not null,
  slug text unique not null,
  description text,
  status entity_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists divisions_updated_at on divisions;
create trigger divisions_updated_at
  before update on divisions
  for each row execute function set_updated_at();

create table if not exists user_divisions (
  user_id uuid not null references profiles (id) on delete cascade,
  division_id uuid not null references divisions (id) on delete cascade,
  membership_type text not null default 'MEMBER',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, division_id)
);

create index if not exists user_divisions_division_id on user_divisions (division_id);
create index if not exists user_divisions_user_id on user_divisions (user_id);

-- Seed organisasi + divisi (idempoten via slug/code).
insert into organizations (name, slug, description)
values ('Study Club', 'study-club', 'Organisasi Study Club: UI/UX, Web, ML.')
on conflict (slug) do update set name = excluded.name;

insert into divisions (organization_id, name, code, slug, description)
select o.id, v.name, v.code, v.slug, v.description
from organizations o
cross join (values
  ('UI/UX Design', 'UIUX', 'ui-ux-design', 'Divisi desain antarmuka dan pengalaman pengguna.'),
  ('Web Development', 'WEB', 'web-development', 'Divisi pengembangan web.'),
  ('Machine Learning', 'ML', 'machine-learning', 'Divisi pembelajaran mesin.')
) as v (name, code, slug, description)
where o.slug = 'study-club'
on conflict (code) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description;

-- Helper keanggotaan divisi
create or replace function is_division_member(p_user_id uuid, p_division_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_divisions
    where user_id = p_user_id
      and division_id = p_division_id
      and ended_at is null
  );
$$;

-- RLS
alter table organizations enable row level security;
alter table divisions enable row level security;
alter table user_divisions enable row level security;

drop policy if exists organizations_select on organizations;
create policy organizations_select on organizations
  for select to authenticated using (true);

drop policy if exists organizations_write on organizations;
create policy organizations_write on organizations
  for all to authenticated
  using (has_permission(auth.uid(), 'settings.manage'))
  with check (has_permission(auth.uid(), 'settings.manage'));

drop policy if exists divisions_select on divisions;
create policy divisions_select on divisions
  for select to authenticated using (true);

drop policy if exists divisions_insert on divisions;
create policy divisions_insert on divisions
  for insert to authenticated
  with check (has_permission(auth.uid(), 'division.create'));

drop policy if exists divisions_update on divisions;
create policy divisions_update on divisions
  for update to authenticated
  using (has_permission(auth.uid(), 'division.update'))
  with check (has_permission(auth.uid(), 'division.update'));

drop policy if exists divisions_delete on divisions;
create policy divisions_delete on divisions
  for delete to authenticated
  using (has_permission(auth.uid(), 'division.delete'));

drop policy if exists user_divisions_select on user_divisions;
create policy user_divisions_select on user_divisions
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'member.view')
  );

drop policy if exists user_divisions_write on user_divisions;
create policy user_divisions_write on user_divisions
  for all to authenticated
  using (has_permission(auth.uid(), 'member.manage'))
  with check (has_permission(auth.uid(), 'member.manage'));

grant select on organizations, divisions to authenticated;
grant all on organizations to authenticated;
grant select, insert, update, delete on divisions to authenticated;
grant select, insert, update, delete on user_divisions to authenticated;
grant all on organizations, divisions, user_divisions to service_role;
