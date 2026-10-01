-- P0-1302: RLS test menemukan kebocoran scope OWN — has_permission()
-- mengabaikan scope, sehingga permission ber-scope OWN (milik sendiri)
-- memberi bacaan global pada policy yang memakainya di klausa "or".
-- Contoh: MEMBER punya grade.view OWN -> bisa membaca SEMUA baris grades.
--
-- Solusi: has_permission_wide() = permission dengan scope <> 'OWN'.
-- Klausa "or" lebar pada policy di bawah diganti ke varian wide; akses
-- milik sendiri tetap lewat klausa kepemilikan (user_id = auth.uid()).
-- Penyempitan scope CLASS/DIVISION tetap di sisi aplikasi (authorization).

create or replace function has_permission_wide(p_user_id uuid, p_permission_code text)
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
    where ur.user_id = p_user_id
      and p.code = p_permission_code
      and rp.scope <> 'OWN'
  );
$$;

-- 1. material_progress: progress.view
drop policy if exists material_progress_select on material_progress;
create policy material_progress_select on material_progress
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission_wide(auth.uid(), 'progress.view')
  );

-- 2. learning_activities: progress.view
drop policy if exists learning_activities_select on learning_activities;
create policy learning_activities_select on learning_activities
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission_wide(auth.uid(), 'progress.view')
  );

-- 3. submissions: submission.view (versi final p1403 + akses kelompok)
drop policy if exists submissions_select on submissions;
create policy submissions_select on submissions
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      assignment_group_id is not null
      and is_group_member(auth.uid(), assignment_group_id)
    )
    or has_permission(auth.uid(), 'assignment.grade')
    or has_permission_wide(auth.uid(), 'submission.view')
  );

-- 4. attendance_records: attendance.view
drop policy if exists attendance_records_select on attendance_records;
create policy attendance_records_select on attendance_records
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission_wide(auth.uid(), 'attendance.view')
    or has_permission(auth.uid(), 'attendance.correct')
  );

-- 5. attendance_corrections: attendance.view
drop policy if exists attendance_corrections_select on attendance_corrections;
create policy attendance_corrections_select on attendance_corrections
  for select to authenticated
  using (
    has_permission_wide(auth.uid(), 'attendance.view')
    or has_permission(auth.uid(), 'attendance.correct')
  );

-- 6. grades: grade.view
drop policy if exists grades_select on grades;
create policy grades_select on grades
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission_wide(auth.uid(), 'grade.view')
    or has_permission(auth.uid(), 'grade.create')
    or has_permission(auth.uid(), 'grade.update')
  );

-- 7. report_cards: grade.view
drop policy if exists report_cards_select on report_cards;
create policy report_cards_select on report_cards
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission_wide(auth.uid(), 'grade.view')
  );

-- 8. point_transactions: point.view
drop policy if exists point_transactions_select on point_transactions;
create policy point_transactions_select on point_transactions
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission_wide(auth.uid(), 'point.view')
    or has_permission(auth.uid(), 'point.manage')
  );

-- 9. storage bucket reports: report.view
drop policy if exists "reports_all" on storage.objects;
create policy "reports_all" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'reports'
    and (
      has_permission(auth.uid(), 'report.export')
      or has_permission_wide(auth.uid(), 'report.view')
    )
  )
  with check (
    bucket_id = 'reports'
    and has_permission(auth.uid(), 'report.export')
  );

-- 10. user_achievements: point.view
drop policy if exists user_achievements_select on user_achievements;
create policy user_achievements_select on user_achievements
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission_wide(auth.uid(), 'point.view')
  );
