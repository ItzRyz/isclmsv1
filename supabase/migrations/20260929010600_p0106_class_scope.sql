-- P0-106: Class scope — batches, academic_periods, classes, class_members.
-- Mentor terikat kelas; member terikat kelas untuk kehadiran/nilai.

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  code text unique not null,
  start_date date,
  end_date date,
  status entity_status not null default 'ACTIVE'
);

create table if not exists academic_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  code text unique not null,
  start_date date,
  end_date date,
  status entity_status not null default 'ACTIVE'
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references divisions (id) on delete cascade,
  batch_id uuid references batches (id),
  academic_period_id uuid references academic_periods (id),
  name text not null,
  code text unique not null,
  capacity integer,
  status entity_status not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table if not exists class_members (
  class_id uuid not null references classes (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  status entity_status not null default 'ACTIVE',
  primary key (class_id, user_id)
);

create index if not exists class_members_class_id on class_members (class_id);
create index if not exists class_members_user_id on class_members (user_id);
create index if not exists classes_division_id on classes (division_id);

-- Helper keanggotaan kelas (aktif = belum keluar + status ACTIVE)
create or replace function is_class_member(p_user_id uuid, p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from class_members
    where user_id = p_user_id
      and class_id = p_class_id
      and left_at is null
      and status = 'ACTIVE'
  );
$$;

-- RLS
alter table batches enable row level security;
alter table academic_periods enable row level security;
alter table classes enable row level security;
alter table class_members enable row level security;

drop policy if exists batches_select on batches;
create policy batches_select on batches
  for select to authenticated using (true);

drop policy if exists batches_write on batches;
create policy batches_write on batches
  for all to authenticated
  using (has_permission(auth.uid(), 'class.create'))
  with check (has_permission(auth.uid(), 'class.create'));

drop policy if exists periods_select on academic_periods;
create policy periods_select on academic_periods
  for select to authenticated using (true);

drop policy if exists periods_write on academic_periods;
create policy periods_write on academic_periods
  for all to authenticated
  using (has_permission(auth.uid(), 'class.create'))
  with check (has_permission(auth.uid(), 'class.create'));

drop policy if exists classes_select on classes;
create policy classes_select on classes
  for select to authenticated using (true);

drop policy if exists classes_insert on classes;
create policy classes_insert on classes
  for insert to authenticated
  with check (has_permission(auth.uid(), 'class.create'));

drop policy if exists classes_update on classes;
create policy classes_update on classes
  for update to authenticated
  using (has_permission(auth.uid(), 'class.update'))
  with check (has_permission(auth.uid(), 'class.update'));

drop policy if exists classes_delete on classes;
create policy classes_delete on classes
  for delete to authenticated
  using (has_permission(auth.uid(), 'class.delete'));

drop policy if exists class_members_select on class_members;
create policy class_members_select on class_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'member.view')
  );

drop policy if exists class_members_write on class_members;
create policy class_members_write on class_members
  for all to authenticated
  using (has_permission(auth.uid(), 'member.manage'))
  with check (has_permission(auth.uid(), 'member.manage'));

grant select on batches, academic_periods to authenticated;
grant all on batches, academic_periods to authenticated;
grant select on classes to authenticated;
grant select, insert, update, delete on classes to authenticated;
grant select, insert, update, delete on class_members to authenticated;
grant all on batches, academic_periods, classes, class_members to service_role;
