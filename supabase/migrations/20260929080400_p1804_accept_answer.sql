-- P1-804: accept_answer() definer — pembuat thread atau moderator
-- boleh menandai jawaban, tanpa membuka UPDATE threads untuk semua.
create or replace function accept_answer(p_thread_id uuid, p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_post_thread uuid;
  v_is_mod boolean;
begin
  select created_by into v_author from forum_threads where id = p_thread_id;
  if v_author is null then
    raise exception 'thread tidak ada';
  end if;

  select thread_id into v_post_thread from forum_posts where id = p_post_id;
  if v_post_thread is null or v_post_thread <> p_thread_id then
    raise exception 'jawaban bukan dari thread ini';
  end if;

  if v_author <> auth.uid() then
    select has_permission(auth.uid(), 'forum.moderate') into v_is_mod;
    if not coalesce(v_is_mod, false) then
      raise exception 'hanya penanya atau moderator';
    end if;
  end if;

  update forum_threads set accepted_post_id = p_post_id where id = p_thread_id;
end;
$$;

revoke all on function accept_answer(uuid, uuid) from public, anon;
grant execute on function accept_answer(uuid, uuid) to authenticated;
grant execute on function accept_answer(uuid, uuid) to service_role;
