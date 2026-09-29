-- Fase 3 (P1-301..309): Learning tables + RLS (database.md §4).
-- Status konten: DRAFT -> PUBLISHED -> ARCHIVED.
-- Bacaan: published terlihat semua authenticated; draf hanya staf ber-permission.
-- Data milik user (progress/bookmark/activity): own + progress.view staf.

do $$ begin
  create type content_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
exception when duplicate_object then null;
end $$;

-- 1. courses
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references divisions (id) on delete cascade,
  name text not null,
  slug text not null,
  code text,
  description text,
  status content_status not null default 'DRAFT',
  difficulty text,
  estimated_hours integer,
  published_at timestamptz,
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (division_id, slug)
);
create index if not exists courses_division_id on courses (division_id);
drop trigger if exists courses_updated_at on courses;
create trigger courses_updated_at
  before update on courses
  for each row execute function set_updated_at();

-- 2. modules
create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  title text not null,
  slug text not null,
  position integer not null default 0,
  description text,
  status content_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);
create index if not exists modules_course_id on modules (course_id);
drop trigger if exists modules_updated_at on modules;
create trigger modules_updated_at
  before update on modules
  for each row execute function set_updated_at();

-- 3. materials
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules (id) on delete cascade,
  title text not null,
  slug text not null,
  type text not null default 'TEXT',
  description text,
  content_text text,
  estimated_minutes integer,
  is_required boolean not null default true,
  status content_status not null default 'DRAFT',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, slug)
);
create index if not exists materials_module_id on materials (module_id);
create index if not exists materials_status on materials (status);
drop trigger if exists materials_updated_at on materials;
create trigger materials_updated_at
  before update on materials
  for each row execute function set_updated_at();

-- 4. material_files
create table if not exists material_files (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials (id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  checksum text,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

-- 5. material_links
create table if not exists material_links (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials (id) on delete cascade,
  url text not null,
  title text,
  created_at timestamptz not null default now()
);

-- 6. material_prerequisites
create table if not exists material_prerequisites (
  material_id uuid not null references materials (id) on delete cascade,
  prerequisite_material_id uuid not null references materials (id) on delete cascade,
  primary key (material_id, prerequisite_material_id),
  check (material_id <> prerequisite_material_id)
);

-- 7. material_progress
create table if not exists material_progress (
  user_id uuid not null references profiles (id) on delete cascade,
  material_id uuid not null references materials (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  last_position text,
  updated_at timestamptz not null default now(),
  primary key (user_id, material_id)
);

-- 8. material_bookmarks
create table if not exists material_bookmarks (
  user_id uuid not null references profiles (id) on delete cascade,
  material_id uuid not null references materials (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, material_id)
);

-- 9. learning_activities
create table if not exists learning_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  activity_type text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists learning_activities_user_id on learning_activities (user_id);

-- 10. RLS
alter table courses enable row level security;
alter table modules enable row level security;
alter table materials enable row level security;
alter table material_files enable row level security;
alter table material_links enable row level security;
alter table material_prerequisites enable row level security;
alter table material_progress enable row level security;
alter table material_bookmarks enable row level security;
alter table learning_activities enable row level security;

-- courses: publik bila PUBLISHED, draf hanya staf course.*.
drop policy if exists courses_select on courses;
create policy courses_select on courses
  for select to authenticated
  using (
    status = 'PUBLISHED'
    or has_permission(auth.uid(), 'course.create')
    or has_permission(auth.uid(), 'course.update')
    or has_permission(auth.uid(), 'course.delete')
  );
drop policy if exists courses_insert on courses;
create policy courses_insert on courses
  for insert to authenticated
  with check (has_permission(auth.uid(), 'course.create'));
drop policy if exists courses_update on courses;
create policy courses_update on courses
  for update to authenticated
  using (has_permission(auth.uid(), 'course.update'))
  with check (has_permission(auth.uid(), 'course.update'));
drop policy if exists courses_delete on courses;
create policy courses_delete on courses
  for delete to authenticated
  using (has_permission(auth.uid(), 'course.delete'));

-- modules/materials: pola sama dengan permission masing-masing.
drop policy if exists modules_select on modules;
create policy modules_select on modules
  for select to authenticated
  using (
    status = 'PUBLISHED'
    or has_permission(auth.uid(), 'module.create')
    or has_permission(auth.uid(), 'module.update')
    or has_permission(auth.uid(), 'module.delete')
  );
drop policy if exists modules_write on modules;
create policy modules_write on modules
  for all to authenticated
  using (
    has_permission(auth.uid(), 'module.create')
    or has_permission(auth.uid(), 'module.update')
    or has_permission(auth.uid(), 'module.delete')
  )
  with check (
    has_permission(auth.uid(), 'module.create')
    or has_permission(auth.uid(), 'module.update')
    or has_permission(auth.uid(), 'module.delete')
  );

drop policy if exists materials_select on materials;
create policy materials_select on materials
  for select to authenticated
  using (
    status = 'PUBLISHED'
    or has_permission(auth.uid(), 'material.create')
    or has_permission(auth.uid(), 'material.update')
    or has_permission(auth.uid(), 'material.delete')
  );
drop policy if exists materials_write on materials;
create policy materials_write on materials
  for all to authenticated
  using (
    has_permission(auth.uid(), 'material.create')
    or has_permission(auth.uid(), 'material.update')
    or has_permission(auth.uid(), 'material.delete')
  )
  with check (
    has_permission(auth.uid(), 'material.create')
    or has_permission(auth.uid(), 'material.update')
    or has_permission(auth.uid(), 'material.delete')
  );

-- files/links/prerequisites: baca authenticated, tulis material.*.
drop policy if exists material_files_select on material_files;
create policy material_files_select on material_files
  for select to authenticated using (true);
drop policy if exists material_files_write on material_files;
create policy material_files_write on material_files
  for all to authenticated
  using (has_permission(auth.uid(), 'material.update'))
  with check (has_permission(auth.uid(), 'material.update'));

drop policy if exists material_links_select on material_links;
create policy material_links_select on material_links
  for select to authenticated using (true);
drop policy if exists material_links_write on material_links;
create policy material_links_write on material_links
  for all to authenticated
  using (has_permission(auth.uid(), 'material.update'))
  with check (has_permission(auth.uid(), 'material.update'));

drop policy if exists material_prerequisites_select on material_prerequisites;
create policy material_prerequisites_select on material_prerequisites
  for select to authenticated using (true);
drop policy if exists material_prerequisites_write on material_prerequisites;
create policy material_prerequisites_write on material_prerequisites
  for all to authenticated
  using (has_permission(auth.uid(), 'material.update'))
  with check (has_permission(auth.uid(), 'material.update'));

-- progress: milik sendiri + staf progress.view.
drop policy if exists material_progress_select on material_progress;
create policy material_progress_select on material_progress
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'progress.view')
  );
drop policy if exists material_progress_write on material_progress;
create policy material_progress_write on material_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- bookmarks: milik sendiri penuh.
drop policy if exists material_bookmarks_all on material_bookmarks;
create policy material_bookmarks_all on material_bookmarks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- activities: tulis sendiri, baca sendiri + staf.
drop policy if exists learning_activities_insert on learning_activities;
create policy learning_activities_insert on learning_activities
  for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists learning_activities_select on learning_activities;
create policy learning_activities_select on learning_activities
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'progress.view')
  );

-- Grants
grant select, insert, update, delete on courses to authenticated;
grant select, insert, update, delete on modules to authenticated;
grant select, insert, update, delete on materials to authenticated;
grant select, insert, update, delete on material_files to authenticated;
grant select, insert, update, delete on material_links to authenticated;
grant select, insert, update, delete on material_prerequisites to authenticated;
grant select, insert, update, delete on material_progress to authenticated;
grant select, insert, update, delete on material_bookmarks to authenticated;
grant select, insert on learning_activities to authenticated;
grant all on courses, modules, materials, material_files, material_links,
  material_prerequisites, material_progress, material_bookmarks,
  learning_activities to service_role;
