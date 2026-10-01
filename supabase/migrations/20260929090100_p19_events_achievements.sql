-- Fase 9 (P2-901..905): Events, kompetisi, achievements, sertifikat (database.md §12).
-- Kompetisi dimodelkan eksplisit (tidak ada tabelnya di spek).
-- Sertifikat: verifikasi publik via fungsi definer (data minimal, tanpa RLS anon).

-- 1. events
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  division_id uuid references divisions (id) on delete cascade,
  type text not null default 'GENERAL',
  name text not null,
  slug text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  capacity integer check (capacity is null or capacity > 0),
  status content_status not null default 'DRAFT',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  check (ends_at > starts_at)
);
drop trigger if exists events_updated_at on events;
create trigger events_updated_at
  before update on events
  for each row execute function set_updated_at();

-- 2. event_participants
create table if not exists event_participants (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'REGISTERED',
  registered_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- 3. event_attendance
create table if not exists event_attendance (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'PRESENT',
  checked_in_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- 4. competitions
create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  division_id uuid references divisions (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  status content_status not null default 'DRAFT',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
drop trigger if exists competitions_updated_at on competitions;
create trigger competitions_updated_at
  before update on competitions
  for each row execute function set_updated_at();

-- 5. competition_participants (hasil = rank/score, poin via ledger)
create table if not exists competition_participants (
  competition_id uuid not null references competitions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'REGISTERED',
  rank integer check (rank is null or rank >= 1),
  score numeric check (score is null or score >= 0),
  points_awarded integer not null default 0,
  registered_at timestamptz not null default now(),
  unique (competition_id, user_id)
);

-- 6. achievements + rules + perolehan
create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  icon text not null default '🏅',
  status entity_status not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table if not exists achievement_rules (
  id uuid primary key default gen_random_uuid(),
  achievement_id uuid not null references achievements (id) on delete cascade,
  event_type text not null,
  threshold integer not null check (threshold >= 1),
  configuration jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists user_achievements (
  user_id uuid not null references profiles (id) on delete cascade,
  achievement_id uuid not null references achievements (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  source_type text,
  source_id text,
  primary key (user_id, achievement_id)
);

-- Seed achievements deterministik + aturan.
insert into achievements (code, name, description, icon, status)
values
  ('FIRST_STEP', 'Langkah Pertama', 'Selesaikan 1 materi.', '👣', 'ACTIVE'),
  ('CONSISTENT_10', 'Konsisten 10', 'Selesaikan 10 materi.', '🔥', 'ACTIVE'),
  ('QUIZ_STAR', 'Bintang Kuis', 'Lulus 1 kuis.', '⭐', 'ACTIVE'),
  ('PRESENT_5', 'Hadir 5x', 'Hadir 5 sesi.', '📅', 'ACTIVE')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  status = excluded.status;

insert into achievement_rules (achievement_id, event_type, threshold, configuration)
select a.id, v.event_type, v.threshold, v.configuration
from achievements a
join (values
  ('FIRST_STEP', 'material.complete', 1, '{"points": 10}'::jsonb),
  ('CONSISTENT_10', 'material.complete', 10, '{"points": 50}'::jsonb),
  ('QUIZ_STAR', 'quiz.passed', 1, '{"points": 30}'::jsonb),
  ('PRESENT_5', 'attendance.present', 5, '{"points": 25}'::jsonb)
) as v (code, event_type, threshold, configuration) on v.code = a.code
on conflict do nothing;

-- 7. certificates
create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text unique not null,
  user_id uuid not null references profiles (id) on delete cascade,
  division_id uuid references divisions (id) on delete set null,
  academic_period_id uuid references academic_periods (id) on delete set null,
  program_name text not null,
  issued_at timestamptz not null default now(),
  issuer_name text not null,
  verification_token text unique not null,
  pdf_path text
);
create index if not exists certificates_user_id on certificates (user_id);

-- Verifikasi publik minimal (tanpa RLS anon): fungsi definer.
create or replace function verify_certificate(p_token text)
returns table (
  certificate_number text,
  full_name text,
  program_name text,
  issued_at timestamptz,
  issuer_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.certificate_number,
    p.full_name,
    c.program_name,
    c.issued_at,
    c.issuer_name
  from certificates c
  join profiles p on p.id = c.user_id
  where c.verification_token = p_token;
$$;

revoke all on function verify_certificate(text) from public, anon;
grant execute on function verify_certificate(text) to authenticated, anon, service_role;

-- 8. RLS
alter table events enable row level security;
alter table event_participants enable row level security;
alter table event_attendance enable row level security;
alter table competitions enable row level security;
alter table competition_participants enable row level security;
alter table achievements enable row level security;
alter table achievement_rules enable row level security;
alter table user_achievements enable row level security;
alter table certificates enable row level security;

-- events/competitions: baca published + staf; tulis event.create/update/delete.
drop policy if exists events_select on events;
create policy events_select on events
  for select to authenticated
  using (
    status = 'PUBLISHED'
    or has_permission(auth.uid(), 'event.create')
    or has_permission(auth.uid(), 'event.update')
  );
drop policy if exists events_write on events;
create policy events_write on events
  for all to authenticated
  using (
    has_permission(auth.uid(), 'event.create')
    or has_permission(auth.uid(), 'event.update')
    or has_permission(auth.uid(), 'event.delete')
  )
  with check (
    has_permission(auth.uid(), 'event.create')
    or has_permission(auth.uid(), 'event.update')
    or has_permission(auth.uid(), 'event.delete')
  );

drop policy if exists event_participants_select on event_participants;
create policy event_participants_select on event_participants
  for select to authenticated using (true);
drop policy if exists event_participants_write on event_participants;
create policy event_participants_write on event_participants
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists event_attendance_select on event_attendance;
create policy event_attendance_select on event_attendance
  for select to authenticated using (true);
drop policy if exists event_attendance_write on event_attendance;
create policy event_attendance_write on event_attendance
  for all to authenticated
  using (
    has_permission(auth.uid(), 'attendance.correct')
    or has_permission(auth.uid(), 'attendance.open_session')
  )
  with check (
    has_permission(auth.uid(), 'attendance.correct')
    or has_permission(auth.uid(), 'attendance.open_session')
  );

drop policy if exists competitions_select on competitions;
create policy competitions_select on competitions
  for select to authenticated
  using (
    status = 'PUBLISHED'
    or has_permission(auth.uid(), 'event.create')
    or has_permission(auth.uid(), 'event.update')
  );
drop policy if exists competitions_write on competitions;
create policy competitions_write on competitions
  for all to authenticated
  using (
    has_permission(auth.uid(), 'event.create')
    or has_permission(auth.uid(), 'event.update')
    or has_permission(auth.uid(), 'event.delete')
  )
  with check (
    has_permission(auth.uid(), 'event.create')
    or has_permission(auth.uid(), 'event.update')
    or has_permission(auth.uid(), 'event.delete')
  );

drop policy if exists competition_participants_select on competition_participants;
create policy competition_participants_select on competition_participants
  for select to authenticated using (true);
drop policy if exists competition_participants_write on competition_participants;
create policy competition_participants_write on competition_participants
  for all to authenticated
  using (
    has_permission(auth.uid(), 'event.create')
    or has_permission(auth.uid(), 'event.update')
  )
  with check (
    has_permission(auth.uid(), 'event.create')
    or has_permission(auth.uid(), 'event.update')
  );

-- achievements: baca semua; tulis terbatas (seed via migrasi).
drop policy if exists achievements_select on achievements;
create policy achievements_select on achievements
  for select to authenticated using (true);
drop policy if exists achievement_rules_select on achievement_rules;
create policy achievement_rules_select on achievement_rules
  for select to authenticated using (true);
drop policy if exists user_achievements_select on user_achievements;
create policy user_achievements_select on user_achievements
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'point.view')
  );
drop policy if exists user_achievements_insert on user_achievements;
create policy user_achievements_insert on user_achievements
  for insert to authenticated
  with check (has_permission(auth.uid(), 'point.manage'));

-- certificates: pemilik + staf; tulis penerbit. Publik via verify_certificate().
drop policy if exists certificates_select on certificates;
create policy certificates_select on certificates
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'certificate.view')
    or has_permission(auth.uid(), 'certificate.issue')
  );
drop policy if exists certificates_write on certificates;
create policy certificates_write on certificates
  for all to authenticated
  using (has_permission(auth.uid(), 'certificate.issue'))
  with check (has_permission(auth.uid(), 'certificate.issue'));

-- Grants
grant select, insert, update, delete on events to authenticated;
grant select, insert, update, delete on event_participants to authenticated;
grant select, insert, update, delete on event_attendance to authenticated;
grant select, insert, update, delete on competitions to authenticated;
grant select, insert, update, delete on competition_participants to authenticated;
grant select on achievements to authenticated;
grant select on achievement_rules to authenticated;
grant select, insert on user_achievements to authenticated;
grant select, insert, update, delete on certificates to authenticated;
grant all on events, event_participants, event_attendance, competitions,
  competition_participants, achievements, achievement_rules,
  user_achievements, certificates to service_role;
