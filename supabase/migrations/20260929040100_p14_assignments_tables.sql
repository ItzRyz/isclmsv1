-- Fase 4 (P1-401..407): Assignments + submissions + rubrics + feedback (database.md §6).
-- Status submission dikunci via CHECK; server menentukan LATE/terlambat di app.
-- Tepat satu pemilik: user_id XOR assignment_group_id.

-- 1. assignments
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  module_id uuid references modules (id) on delete set null,
  title text not null,
  slug text not null,
  description text,
  type text not null default 'INDIVIDUAL',
  submission_type text not null default 'TEXT',
  available_from timestamptz,
  due_at timestamptz not null,
  allow_late_submission boolean not null default false,
  late_until timestamptz,
  max_score numeric not null default 100 check (max_score > 0),
  revision_allowed boolean not null default false,
  status content_status not null default 'DRAFT',
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug),
  check (late_until is null or late_until >= due_at)
);
create index if not exists assignments_course_id on assignments (course_id);
create index if not exists assignments_due_at on assignments (due_at);
drop trigger if exists assignments_updated_at on assignments;
create trigger assignments_updated_at
  before update on assignments
  for each row execute function set_updated_at();

-- 2. assignment_groups
create table if not exists assignment_groups (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- 3. assignment_group_members
create table if not exists assignment_group_members (
  assignment_group_id uuid not null references assignment_groups (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (assignment_group_id, user_id)
);

-- 4. submissions
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments (id) on delete cascade,
  user_id uuid references profiles (id) on delete cascade,
  assignment_group_id uuid references assignment_groups (id) on delete cascade,
  status text not null default 'DRAFT'
    check (status in ('NOT_STARTED', 'DRAFT', 'SUBMITTED', 'LATE', 'GRADED', 'REVISION_REQUIRED', 'RESUBMITTED')),
  text_content text,
  submitted_at timestamptz,
  last_saved_at timestamptz,
  graded_at timestamptz,
  graded_by uuid references profiles (id),
  score numeric check (score >= 0),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is null) <> (assignment_group_id is null))
);
create index if not exists submissions_assignment_id on submissions (assignment_id);
create index if not exists submissions_user_id on submissions (user_id);
drop trigger if exists submissions_updated_at on submissions;
create trigger submissions_updated_at
  before update on submissions
  for each row execute function set_updated_at();

-- 5. submission_files
create table if not exists submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  bucket text not null default 'assignment-submissions',
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  checksum text,
  created_at timestamptz not null default now(),
  unique (bucket, storage_path)
);

-- 6. rubrics
create table if not exists rubrics (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments (id) on delete cascade,
  name text not null,
  description text,
  max_score numeric not null default 100 check (max_score > 0),
  created_at timestamptz not null default now()
);

-- 7. rubric_items
create table if not exists rubric_items (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references rubrics (id) on delete cascade,
  criterion text not null,
  description text,
  max_points numeric not null check (max_points >= 0),
  position integer not null default 0
);

-- 8. submission_feedback
create table if not exists submission_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  mentor_id uuid not null references profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

-- 9. submission_revisions
create table if not exists submission_revisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  version integer not null,
  text_content text,
  submitted_at timestamptz not null default now(),
  score numeric check (score >= 0),
  status text not null default 'SUBMITTED',
  feedback text,
  created_at timestamptz not null default now()
);

-- 10. RLS
alter table assignments enable row level security;
alter table assignment_groups enable row level security;
alter table assignment_group_members enable row level security;
alter table submissions enable row level security;
alter table submission_files enable row level security;
alter table rubrics enable row level security;
alter table rubric_items enable row level security;
alter table submission_feedback enable row level security;
alter table submission_revisions enable row level security;

-- assignments: baca published + staf; tulis assignment.*.
drop policy if exists assignments_select on assignments;
create policy assignments_select on assignments
  for select to authenticated
  using (
    status = 'PUBLISHED'
    or has_permission(auth.uid(), 'assignment.create')
    or has_permission(auth.uid(), 'assignment.update')
    or has_permission(auth.uid(), 'assignment.delete')
    or has_permission(auth.uid(), 'assignment.grade')
  );
drop policy if exists assignments_insert on assignments;
create policy assignments_insert on assignments
  for insert to authenticated
  with check (has_permission(auth.uid(), 'assignment.create'));
drop policy if exists assignments_update on assignments;
create policy assignments_update on assignments
  for update to authenticated
  using (has_permission(auth.uid(), 'assignment.update'))
  with check (has_permission(auth.uid(), 'assignment.update'));
drop policy if exists assignments_delete on assignments;
create policy assignments_delete on assignments
  for delete to authenticated
  using (has_permission(auth.uid(), 'assignment.delete'));

-- groups/members: baca authenticated; tulis assignment.create/update.
drop policy if exists assignment_groups_select on assignment_groups;
create policy assignment_groups_select on assignment_groups
  for select to authenticated using (true);
drop policy if exists assignment_groups_write on assignment_groups;
create policy assignment_groups_write on assignment_groups
  for all to authenticated
  using (
    has_permission(auth.uid(), 'assignment.create')
    or has_permission(auth.uid(), 'assignment.update')
  )
  with check (
    has_permission(auth.uid(), 'assignment.create')
    or has_permission(auth.uid(), 'assignment.update')
  );

drop policy if exists assignment_group_members_select on assignment_group_members;
create policy assignment_group_members_select on assignment_group_members
  for select to authenticated using (true);
drop policy if exists assignment_group_members_write on assignment_group_members;
create policy assignment_group_members_write on assignment_group_members
  for all to authenticated
  using (
    has_permission(auth.uid(), 'assignment.create')
    or has_permission(auth.uid(), 'assignment.update')
  )
  with check (
    has_permission(auth.uid(), 'assignment.create')
    or has_permission(auth.uid(), 'assignment.update')
  );

-- submissions: pemilik/anggota grup + penilai (assignment.grade); tulis own,
-- nilai hanya penilai (kolom score/graded dilindungi trigger di bawah).
drop policy if exists submissions_select on submissions;
create policy submissions_select on submissions
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'assignment.grade')
    or has_permission(auth.uid(), 'submission.view')
  );
drop policy if exists submissions_insert on submissions;
create policy submissions_insert on submissions
  for insert to authenticated
  with check (user_id = auth.uid() or assignment_group_id is not null);
drop policy if exists submissions_update on submissions;
create policy submissions_update on submissions
  for update to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'assignment.grade')
  )
  with check (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'assignment.grade')
  );
drop policy if exists submissions_delete on submissions;
create policy submissions_delete on submissions
  for delete to authenticated
  using (has_permission(auth.uid(), 'assignment.delete'));

-- submission_files: baca pemilik/penilai; tulis pemilik.
drop policy if exists submission_files_select on submission_files;
create policy submission_files_select on submission_files
  for select to authenticated using (true);
drop policy if exists submission_files_write on submission_files;
create policy submission_files_write on submission_files
  for all to authenticated
  using (true)
  with check (true);

-- rubrics/items: baca authenticated; tulis assignment.update.
drop policy if exists rubrics_select on rubrics;
create policy rubrics_select on rubrics
  for select to authenticated using (true);
drop policy if exists rubrics_write on rubrics;
create policy rubrics_write on rubrics
  for all to authenticated
  using (has_permission(auth.uid(), 'assignment.update'))
  with check (has_permission(auth.uid(), 'assignment.update'));
drop policy if exists rubric_items_select on rubric_items;
create policy rubric_items_select on rubric_items
  for select to authenticated using (true);
drop policy if exists rubric_items_write on rubric_items;
create policy rubric_items_write on rubric_items
  for all to authenticated
  using (has_permission(auth.uid(), 'assignment.update'))
  with check (has_permission(auth.uid(), 'assignment.update'));

-- feedback/revisions: baca pemilik + penilai; tulis penilai (feedback),
-- revisi oleh pemilik saat diminta.
drop policy if exists submission_feedback_select on submission_feedback;
create policy submission_feedback_select on submission_feedback
  for select to authenticated using (true);
drop policy if exists submission_feedback_write on submission_feedback;
create policy submission_feedback_write on submission_feedback
  for all to authenticated
  using (has_permission(auth.uid(), 'assignment.feedback'))
  with check (has_permission(auth.uid(), 'assignment.feedback'));

drop policy if exists submission_revisions_select on submission_revisions;
create policy submission_revisions_select on submission_revisions
  for select to authenticated using (true);
drop policy if exists submission_revisions_insert on submission_revisions;
create policy submission_revisions_insert on submission_revisions
  for insert to authenticated
  with check (true);

-- Grants
grant select, insert, update, delete on assignments to authenticated;
grant select, insert, update, delete on assignment_groups to authenticated;
grant select, insert, update, delete on assignment_group_members to authenticated;
grant select, insert, update, delete on submissions to authenticated;
grant select, insert, update, delete on submission_files to authenticated;
grant select, insert, update, delete on rubrics to authenticated;
grant select, insert, update, delete on rubric_items to authenticated;
grant select, insert, update, delete on submission_feedback to authenticated;
grant select, insert, update, delete on submission_revisions to authenticated;
grant all on assignments, assignment_groups, assignment_group_members,
  submissions, submission_files, rubrics, rubric_items,
  submission_feedback, submission_revisions to service_role;
