-- P0-102: Roles — tabel + seed 10 peran sistem (database.md §2, rbac.md §2).
-- Tulis role hanya via jalur privileged (tanpa policy INSERT/UPDATE/DELETE
-- untuk authenticated); baca katalog diizinkan untuk authenticated.

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

insert into roles (code, name, description, is_system) values
  ('SUPER_ADMIN', 'Super Admin', 'Otoritas administratif global.', true),
  ('LEADER', 'Leader', 'Pengawas organisasi/LMS.', true),
  ('CO_LEADER', 'Co-Leader', 'Operasional organisasi.', true),
  ('SECRETARY', 'Secretary', 'Dokumentasi, absensi, kalender.', true),
  ('TREASURER', 'Treasurer', 'Keuangan organisasi.', true),
  ('WEB_COORDINATOR', 'Web Coordinator', 'Divisi Web Development.', true),
  ('ML_COORDINATOR', 'ML Coordinator', 'Divisi Machine Learning.', true),
  ('UIUX_COORDINATOR', 'UI/UX Coordinator', 'Divisi UI/UX Design.', true),
  ('MENTOR', 'Mentor', 'Konten dan penilaian kelas/course dalam scope.', true),
  ('MEMBER', 'Member', 'Peserta dengan akses own + bacaan yang diizinkan.', true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system;

alter table roles enable row level security;

drop policy if exists roles_select_all on roles;
create policy roles_select_all on roles
  for select to authenticated
  using (true);

grant select on roles to authenticated;
grant all on roles to service_role;
