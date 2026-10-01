-- P0-1302: RLS test menemukan celah — satu-satunya policy UPDATE profiles
-- adalah profiles_update_own (auth.uid() = id), sehingga admin dengan
-- user.update tidak bisa mengubah profil user lain (update 0 baris senyap).
-- Tambah policy staf. Trigger profiles_status_guard tetap menuntut
-- user.update untuk perubahan status (defense in depth).

drop policy if exists profiles_update_staff on profiles;
create policy profiles_update_staff on profiles
  for update to authenticated
  using (has_permission(auth.uid(), 'user.update'))
  with check (has_permission(auth.uid(), 'user.update'));
