-- P1-304: Storage privat + kebijakan akses (deployment.md §12).
-- Semua bucket PRIVATE. Unduh hanya via signed URL yang diterbitkan
-- server setelah cek akses materi. Tulis file hanya staf ber-permission.

insert into storage.buckets (id, name, public)
values
  ('materials-private', 'materials-private', false),
  ('assignment-submissions', 'assignment-submissions', false),
  ('organization-documents', 'organization-documents', false),
  ('reports', 'reports', false),
  ('certificates', 'certificates', false)
on conflict (id) do nothing;

-- materials-private: upload oleh staf material.*, baca pemilik/uploader atau staf.
drop policy if exists "materials_private_insert" on storage.objects;
create policy "materials_private_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materials-private'
    and (
      has_permission(auth.uid(), 'material.create')
      or has_permission(auth.uid(), 'material.update')
    )
  );

drop policy if exists "materials_private_select" on storage.objects;
create policy "materials_private_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materials-private'
    and (
      owner = auth.uid()
      or has_permission(auth.uid(), 'material.view')
      or has_permission(auth.uid(), 'material.update')
    )
  );

drop policy if exists "materials_private_delete" on storage.objects;
create policy "materials_private_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materials-private'
    and has_permission(auth.uid(), 'material.delete')
  );

-- assignment-submissions: peserta mengunggah miliknya; penilai membaca.
drop policy if exists "submissions_insert_own" on storage.objects;
create policy "submissions_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assignment-submissions'
    and owner = auth.uid()
  );

drop policy if exists "submissions_select" on storage.objects;
create policy "submissions_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assignment-submissions'
    and (
      owner = auth.uid()
      or has_permission(auth.uid(), 'assignment.grade')
    )
  );

-- organization-documents: staf settings.manage.
drop policy if exists "org_docs_all" on storage.objects;
create policy "org_docs_all" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'organization-documents'
    and has_permission(auth.uid(), 'settings.manage')
  )
  with check (
    bucket_id = 'organization-documents'
    and has_permission(auth.uid(), 'settings.manage')
  );

-- reports: penerbit laporan.
drop policy if exists "reports_all" on storage.objects;
create policy "reports_all" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'reports'
    and (
      has_permission(auth.uid(), 'report.export')
      or has_permission(auth.uid(), 'report.view')
    )
  )
  with check (
    bucket_id = 'reports'
    and has_permission(auth.uid(), 'report.export')
  );

-- certificates: penerbit + pemilik sertifikat (klaim via metadata JSON fase 9).
drop policy if exists "certificates_all" on storage.objects;
create policy "certificates_all" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'certificates'
    and has_permission(auth.uid(), 'certificate.issue')
  )
  with check (
    bucket_id = 'certificates'
    and has_permission(auth.uid(), 'certificate.issue')
  );
