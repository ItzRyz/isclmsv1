-- P2-903: mesin achievement deterministik di database.
-- check_achievements() menilai SEMUA aturan untuk auth.uid(), memberi yang
-- memenuhi ambang + poin, idempoten (PK user_achievements). Dipanggil app
-- setiap event pemicu; RLS mentah tetap menolak tulis langsung.
create or replace function check_achievements()
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_material_done integer := 0;
  v_quiz_passed integer := 0;
  v_present integer := 0;
  r record;
  v_awarded text[] := '{}';
  v_points integer;
begin
  if v_user is null then
    return v_awarded;
  end if;

  select count(*) into v_material_done
  from material_progress
  where user_id = v_user and completed_at is not null;

  select count(*) into v_quiz_passed
  from quiz_attempts qa
  join quizzes q on q.id = qa.quiz_id
  where qa.user_id = v_user
    and qa.status = 'GRADED'
    and (q.passing_score is null or qa.score >= q.passing_score);

  select count(*) into v_present
  from attendance_records
  where user_id = v_user and status in ('PRESENT', 'LATE');

  for r in
    select ar.event_type, ar.threshold, ar.configuration, a.code
    from achievement_rules ar
    join achievements a on a.id = ar.achievement_id
    where a.status = 'ACTIVE'
  loop
    declare
      v_count integer :=
        case r.event_type
          when 'material.complete' then v_material_done
          when 'quiz.passed' then v_quiz_passed
          when 'attendance.present' then v_present
          else -1
        end;
    begin
      if v_count >= r.threshold then
        insert into user_achievements (user_id, achievement_id, source_type)
        values (v_user, (select id from achievements where code = r.code), r.event_type)
        on conflict do nothing;
        if found then
          v_points := coalesce(((r.configuration ->> 'points')::integer), 0);
          if v_points <> 0 then
            insert into point_transactions
              (user_id, amount, point_type, source_type, description, created_by)
            values
              (v_user, v_points, 'ACHIEVEMENT', 'ACHIEVEMENT',
               'Achievement ' || r.code, v_user);
          end if;
          v_awarded := v_awarded || r.code;
        end if;
      end if;
    end;
  end loop;

  return v_awarded;
end;
$$;

revoke all on function check_achievements() from public, anon;
grant execute on function check_achievements() to authenticated;
grant execute on function check_achievements() to service_role;
