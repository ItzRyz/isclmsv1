-- P0-103: Permissions + baseline role_permissions (rbac.md §4, §6).
-- Katalog ~86 permission dari taksonomi rbac.md.
-- Baseline = proposal awal-prod; perubahan butuh migrasi baru + audit.
-- Helper has_permission() menyusul di P0-104 (butuh user_roles).

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  resource text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now()
);

insert into permissions (code, resource, action, description)
select
  c,
  split_part(c, '.', 1),
  split_part(c, '.', 2),
  'Permission ' || c
from unnest(array[
  'user.view', 'user.create', 'user.update', 'user.deactivate', 'user.assign_role',
  'role.view', 'role.create', 'role.update', 'role.delete', 'permission.view', 'permission.manage',
  'division.view', 'division.create', 'division.update', 'division.delete',
  'class.view', 'class.create', 'class.update', 'class.delete',
  'member.view', 'member.manage',
  'course.view', 'course.create', 'course.update', 'course.delete',
  'module.view', 'module.create', 'module.update', 'module.delete',
  'material.view', 'material.create', 'material.update', 'material.delete', 'material.publish',
  'roadmap.view', 'roadmap.manage', 'progress.view',
  'assignment.view', 'assignment.create', 'assignment.update', 'assignment.delete',
  'assignment.publish', 'assignment.grade', 'assignment.feedback',
  'submission.view', 'submission.create', 'submission.update_own',
  'quiz.view', 'quiz.create', 'quiz.update', 'quiz.delete', 'quiz.publish', 'quiz.attempt', 'quiz.grade',
  'attendance.view', 'attendance.open_session', 'attendance.check_in', 'attendance.correct', 'attendance.export',
  'grade.view', 'grade.create', 'grade.update', 'grade.publish',
  'point.view', 'point.manage', 'ranking.view', 'ranking.manage', 'report.view', 'report.export',
  'announcement.view', 'announcement.create', 'announcement.update', 'announcement.delete',
  'forum.view', 'forum.create', 'forum.moderate',
  'message.view', 'message.send', 'notification.view', 'notification.manage',
  'event.view', 'event.create', 'event.update', 'event.delete', 'event.register',
  'certificate.issue', 'certificate.view', 'certificate.verify',
  'finance.view', 'finance.create', 'finance.update', 'finance.delete', 'finance.export',
  'audit.view', 'settings.view', 'settings.manage'
]) as c
on conflict (code) do nothing;

create table if not exists role_permissions (
  role_id uuid not null references roles (id) on delete cascade,
  permission_id uuid not null references permissions (id) on delete cascade,
  scope scope_type not null,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id, scope)
);

-- Baseline dibersihkan dulu agar migrasi idempoten dan mapping selalu eksplisit.
delete from role_permissions;

-- SUPER_ADMIN: semua permission, scope GLOBAL.
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'GLOBAL'
from roles r cross join permissions p
where r.code = 'SUPER_ADMIN';

-- LEADER: semua kecuali administrasi RBAC, settings.manage, dan tulis finansial.
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'ORGANIZATION'
from roles r cross join permissions p
where r.code = 'LEADER'
  and p.code not in (
    'role.create', 'role.update', 'role.delete', 'permission.manage',
    'user.assign_role', 'settings.manage',
    'finance.create', 'finance.update', 'finance.delete'
  );

-- CO_LEADER: seperti LEADER minus deaktivasi user, export finansial,
-- ranking.manage, dan penerbitan sertifikat.
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'ORGANIZATION'
from roles r cross join permissions p
where r.code = 'CO_LEADER'
  and p.code not in (
    'role.create', 'role.update', 'role.delete', 'permission.manage',
    'user.assign_role', 'settings.manage',
    'finance.create', 'finance.update', 'finance.delete',
    'user.deactivate', 'finance.export', 'ranking.manage', 'certificate.issue'
  );

-- SECRETARY: dokumentasi, absensi, event dalam scope organisasi.
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'ORGANIZATION'
from roles r cross join permissions p
where r.code = 'SECRETARY'
  and p.code in (
    'user.view', 'member.view', 'division.view', 'class.view',
    'course.view', 'material.view',
    'announcement.view', 'announcement.create', 'announcement.update', 'announcement.delete',
    'attendance.view', 'attendance.open_session', 'attendance.correct', 'attendance.export',
    'event.view', 'event.create', 'event.update',
    'report.view', 'notification.view'
  );

-- TREASURER: finansial + laporan dalam scope organisasi.
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'ORGANIZATION'
from roles r cross join permissions p
where r.code = 'TREASURER'
  and p.code in (
    'finance.view', 'finance.create', 'finance.update', 'finance.delete', 'finance.export',
    'report.view', 'report.export', 'user.view', 'member.view'
  );

-- Koordinator divisi (WEB/ML/UIUX): kelola pembelajaran divisinya.
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'DIVISION'
from roles r cross join permissions p
where r.code in ('WEB_COORDINATOR', 'ML_COORDINATOR', 'UIUX_COORDINATOR')
  and p.code in (
    'division.view', 'division.update', 'member.view', 'member.manage',
    'class.view', 'class.create', 'class.update',
    'course.view', 'course.create', 'course.update', 'course.delete',
    'module.view', 'module.create', 'module.update', 'module.delete',
    'material.view', 'material.create', 'material.update', 'material.delete', 'material.publish',
    'roadmap.view', 'roadmap.manage', 'progress.view',
    'assignment.view', 'assignment.create', 'assignment.update', 'assignment.delete',
    'assignment.publish', 'assignment.grade', 'assignment.feedback', 'submission.view',
    'quiz.view', 'quiz.create', 'quiz.update', 'quiz.delete', 'quiz.publish', 'quiz.grade',
    'attendance.view', 'attendance.open_session', 'attendance.check_in', 'attendance.correct', 'attendance.export',
    'grade.view', 'grade.create', 'grade.update', 'grade.publish',
    'point.view', 'point.manage', 'ranking.view', 'report.view', 'report.export',
    'announcement.view', 'announcement.create', 'announcement.update',
    'forum.view', 'forum.create', 'forum.moderate', 'notification.view',
    'event.view', 'event.create', 'certificate.view'
  );

-- MENTOR: konten dan penilaian dalam scope kelas (penyempitan COURSE menyusul Fase 3).
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'CLASS'
from roles r cross join permissions p
where r.code = 'MENTOR'
  and p.code in (
    'class.view', 'member.view', 'course.view', 'progress.view',
    'material.view', 'material.create', 'material.update',
    'assignment.view', 'assignment.grade', 'assignment.feedback', 'submission.view',
    'quiz.view', 'quiz.grade',
    'attendance.view', 'attendance.check_in',
    'grade.view', 'grade.create', 'grade.update',
    'announcement.view', 'report.view'
  );

-- MEMBER: bacaan organisasi + data milik sendiri.
insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'ORGANIZATION'
from roles r cross join permissions p
where r.code = 'MEMBER'
  and p.code in (
    'course.view', 'material.view', 'roadmap.view',
    'announcement.view', 'forum.view', 'event.view', 'ranking.view', 'certificate.view'
  );

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'OWN'
from roles r cross join permissions p
where r.code = 'MEMBER'
  and p.code in (
    'progress.view', 'submission.view', 'submission.create', 'submission.update_own',
    'quiz.view', 'quiz.attempt', 'attendance.view',
    'grade.view', 'point.view', 'report.view',
    'forum.create', 'message.view', 'message.send', 'notification.view', 'event.register'
  );

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, 'CLASS'
from roles r cross join permissions p
where r.code = 'MEMBER' and p.code = 'attendance.check_in';

-- RLS: katalog hanya-baca untuk authenticated.
alter table permissions enable row level security;
alter table role_permissions enable row level security;

drop policy if exists permissions_select_all on permissions;
create policy permissions_select_all on permissions
  for select to authenticated using (true);

drop policy if exists role_permissions_select_all on role_permissions;
create policy role_permissions_select_all on role_permissions
  for select to authenticated using (true);

grant select on permissions, role_permissions to authenticated;
grant all on permissions, role_permissions to service_role;
