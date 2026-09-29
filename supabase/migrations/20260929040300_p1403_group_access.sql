-- P1-403: akses submission kelompok untuk anggotanya.
-- Baris grup (user_id null) sebelumnya tak bisa dibaca/diubah anggota grup.

create or replace function is_group_member(p_user_id uuid, p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from assignment_group_members
    where user_id = p_user_id and assignment_group_id = p_group_id
  );
$$;

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
    or has_permission(auth.uid(), 'submission.view')
  );

drop policy if exists submissions_update on submissions;
create policy submissions_update on submissions
  for update to authenticated
  using (
    user_id = auth.uid()
    or (
      assignment_group_id is not null
      and is_group_member(auth.uid(), assignment_group_id)
    )
    or has_permission(auth.uid(), 'assignment.grade')
  )
  with check (
    user_id = auth.uid()
    or (
      assignment_group_id is not null
      and is_group_member(auth.uid(), assignment_group_id)
    )
    or has_permission(auth.uid(), 'assignment.grade')
  );
