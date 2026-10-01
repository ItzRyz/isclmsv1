-- P0-1304: uji storage menemukan cleanup deleteUser GoTrue gagal
-- ("Database error deleting user"): haput auth.users -> cascade profiles ->
-- cascade user_roles -> trigger audit_role_change insert audit_logs dengan
-- peran pemanggil (supabase_auth_admin) yang tak punya grant INSERT ->
-- cascade gagal. Jadikan trigger SECURITY DEFINER (owner postgres) agar
-- jejak audit selalu tercatat terlepas dari jalur penghapusan.

create or replace function audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into audit_logs (actor_id, action, entity_type, entity_id, new_values)
    values (
      auth.uid(), 'role.assign', 'user_roles',
      new.user_id::text,
      jsonb_build_object('user_id', new.user_id, 'role_id', new.role_id, 'assigned_by', new.assigned_by)
    );
    return new;
  else
    insert into audit_logs (actor_id, action, entity_type, entity_id, old_values)
    values (
      auth.uid(), 'role.revoke', 'user_roles',
      old.user_id::text,
      jsonb_build_object('user_id', old.user_id, 'role_id', old.role_id)
    );
    return old;
  end if;
end;
$$;
