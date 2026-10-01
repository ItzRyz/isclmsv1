-- P0-1303: uji auth menemukan trigger profiles_status_guard menolak
-- jalur privileged (service/secret key): auth.uid() null -> has_permission
-- false -> exception, padahal service_role adalah backend trusted yang
-- bypass RLS. Izinkan service_role; jalur authenticated tetap butuh
-- user.update (defense in depth di atas policy UPDATE).

create or replace function protect_profile_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and current_user <> 'service_role'
     and not has_permission(auth.uid(), 'user.update') then
    raise exception 'profile status change requires user.update permission';
  end if;
  return new;
end;
$$;
