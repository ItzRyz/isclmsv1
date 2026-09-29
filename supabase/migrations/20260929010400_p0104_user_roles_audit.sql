-- P0-104: Multi-role assignment + audit (database.md §2, §14).
-- user_roles: satu user banyak peran (union akses, deny default di app).
-- audit_logs: jejak perubahan peran (dan dipakai fase berikut untuk
-- nilai/absensi/keuangan). Tulis app diizinkan hanya untuk actor sendiri.

-- 1. user_roles
create table if not exists user_roles (
  user_id uuid not null references profiles (id) on delete cascade,
  role_id uuid not null references roles (id) on delete cascade,
  assigned_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists user_roles_user_id on user_roles (user_id);
create index if not exists user_roles_role_id on user_roles (role_id);

-- 2. audit_logs
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id),
  action text not null,
  entity_type text not null,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  request_id text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_id on audit_logs (actor_id);
create index if not exists audit_logs_entity on audit_logs (entity_type, entity_id);

-- 3. Helper RLS (definer: otorisasi terpusat, index-friendly)
create or replace function has_role(p_user_id uuid, p_role_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and r.code = p_role_code
  );
$$;

create or replace function has_permission(p_user_id uuid, p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    join permissions p on p.id = rp.permission_id
    where ur.user_id = p_user_id and p.code = p_permission_code
  );
$$;

-- 4. Audit otomatis perubahan peran
create or replace function audit_role_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into audit_logs (actor_id, action, entity_type, entity_id, new_values)
    values (
      auth.uid(), 'role.assign', 'user_roles',
      new.user_id::text,
      jsonb_build_object('user_id', new.user_id, 'role_id', new.role_id, 'assigned_by', new.assigned_by)
    );
    return new;
  else
    insert into audit_logs (actor_id, action, entity_type, entity_id, old_values)
    values (
      auth.uid(), 'role.revoke', 'user_roles',
      old.user_id::text,
      jsonb_build_object('user_id', old.user_id, 'role_id', old.role_id)
    );
    return old;
  end if;
end;
$$;

drop trigger if exists user_roles_audit on user_roles;
create trigger user_roles_audit
  after insert or delete on user_roles
  for each row execute function audit_role_change();

-- 5. Proteksi status profil: hanya pemilik user.update yang boleh mengubah.
create or replace function protect_profile_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and not has_permission(auth.uid(), 'user.update') then
    raise exception 'profile status change requires user.update permission';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_status_guard on profiles;
create trigger profiles_status_guard
  before update on profiles
  for each row execute function protect_profile_status();

-- 6. RLS
alter table user_roles enable row level security;
alter table audit_logs enable row level security;

drop policy if exists user_roles_select on user_roles;
create policy user_roles_select on user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'user.view')
    or has_permission(auth.uid(), 'role.view')
  );

drop policy if exists user_roles_insert on user_roles;
create policy user_roles_insert on user_roles
  for insert to authenticated
  with check (has_permission(auth.uid(), 'user.assign_role'));

drop policy if exists user_roles_delete on user_roles;
create policy user_roles_delete on user_roles
  for delete to authenticated
  using (has_permission(auth.uid(), 'user.assign_role'));

-- Tanpa UPDATE: ubah peran = revoke + assign (jejak audit utuh).

drop policy if exists audit_logs_insert on audit_logs;
create policy audit_logs_insert on audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid());

drop policy if exists audit_logs_select on audit_logs;
create policy audit_logs_select on audit_logs
  for select to authenticated
  using (has_permission(auth.uid(), 'audit.view'));

-- 7. Kebijakan baca staf untuk profiles (helper kini tersedia)
drop policy if exists profiles_select_staff on profiles;
create policy profiles_select_staff on profiles
  for select to authenticated
  using (
    has_permission(auth.uid(), 'user.view')
    or has_permission(auth.uid(), 'member.view')
  );

-- 8. Grants
grant select, insert, delete on user_roles to authenticated;
grant select, insert on audit_logs to authenticated;
grant all on user_roles, audit_logs to service_role;
