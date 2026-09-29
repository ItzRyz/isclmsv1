-- Fase 6 (P1-601..608): Attendance (database.md §8).
-- Token sesi hanya disimpan sebagai hash; QR berisi token sekali-pakai
-- yang dirotasi. Koreksi tercatat di attendance_corrections + audit.
-- Baseline P1-103 tidak memberi mentor open_session/correct, padahal
-- P1-606/607 butuh mentor/coordinator entry: dilengkapi di sini (CLASS).

-- 1. attendance_sessions
create table if not exists attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes (id) on delete cascade,
  division_id uuid references divisions (id) on delete cascade,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  geofence_enabled boolean not null default false,
  latitude double precision,
  longitude double precision,
  radius_meters integer check (radius_meters is null or radius_meters > 0),
  session_token_hash text,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'CLOSED')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((class_id is null) <> (division_id is null))
);

-- 2. attendance_records
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  attendance_session_id uuid not null references attendance_sessions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'PRESENT'
    check (status in ('PRESENT', 'LATE', 'PERMITTED', 'SICK', 'ABSENT')),
  method text not null default 'QR_SCAN',
  checked_in_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  source_metadata jsonb not null default '{}',
  unique (attendance_session_id, user_id)
);
create index if not exists attendance_records_session_id on attendance_records (attendance_session_id);
create index if not exists attendance_records_user_id on attendance_records (user_id);

-- 3. attendance_corrections
create table if not exists attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references attendance_records (id) on delete cascade,
  old_status text not null,
  new_status text not null,
  reason text not null,
  corrected_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- 4. Baseline: mentor boleh buka sesi + koreksi dalam scope kelas.
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'CLASS'
from roles r cross join permissions p
where r.code = 'MENTOR'
  and p.code in ('attendance.open_session', 'attendance.correct')
on conflict do nothing;

-- 5. RLS
alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;
alter table attendance_corrections enable row level security;

drop policy if exists attendance_sessions_select on attendance_sessions;
create policy attendance_sessions_select on attendance_sessions
  for select to authenticated using (true);

drop policy if exists attendance_sessions_write on attendance_sessions;
create policy attendance_sessions_write on attendance_sessions
  for all to authenticated
  using (has_permission(auth.uid(), 'attendance.open_session'))
  with check (has_permission(auth.uid(), 'attendance.open_session'));

drop policy if exists attendance_records_select on attendance_records;
create policy attendance_records_select on attendance_records
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'attendance.view')
    or has_permission(auth.uid(), 'attendance.correct')
  );

drop policy if exists attendance_records_insert on attendance_records;
create policy attendance_records_insert on attendance_records
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'attendance.correct')
    or has_permission(auth.uid(), 'attendance.open_session')
  );

drop policy if exists attendance_records_update on attendance_records;
create policy attendance_records_update on attendance_records
  for update to authenticated
  using (has_permission(auth.uid(), 'attendance.correct'))
  with check (has_permission(auth.uid(), 'attendance.correct'));

drop policy if exists attendance_corrections_select on attendance_corrections;
create policy attendance_corrections_select on attendance_corrections
  for select to authenticated
  using (
    has_permission(auth.uid(), 'attendance.view')
    or has_permission(auth.uid(), 'attendance.correct')
  );

drop policy if exists attendance_corrections_insert on attendance_corrections;
create policy attendance_corrections_insert on attendance_corrections
  for insert to authenticated
  with check (has_permission(auth.uid(), 'attendance.correct'));

-- Grants
grant select, insert, update, delete on attendance_sessions to authenticated;
grant select, insert, update on attendance_records to authenticated;
grant select, insert on attendance_corrections to authenticated;
grant all on attendance_sessions, attendance_records, attendance_corrections to service_role;
