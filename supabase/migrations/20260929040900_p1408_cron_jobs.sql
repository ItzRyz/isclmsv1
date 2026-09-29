-- Cron jobs (pg_cron, SQL-only, tanpa biaya tambahan).
-- 1. assignment-due-reminders (tiap 15 mnt): notifikasi tugas PUBLISHED
--    yang deadline < 24 jam, idempoten via tabel notifications.
-- 2. material-scheduled-publish (tiap 5 mnt): flip DRAFT -> PUBLISHED
--    yang scheduled_at sudah lewat (selaras gate visibilitas di app).

create extension if not exists pg_cron;

-- 1. Reminder deadline
create or replace function process_due_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
  select distinct
    ud.user_id,
    'assignment.due_soon',
    'Deadline dekat: ' || a.title,
    'Batas pengumpulan ' || to_char(a.due_at, 'DD Mon YYYY HH24:MI'),
    'assignments',
    a.id::text
  from assignments a
  join courses c on c.id = a.course_id
  join user_divisions ud
    on ud.division_id = c.division_id
    and ud.ended_at is null
  where a.status = 'PUBLISHED'
    and a.due_at > now()
    and a.due_at <= now() + interval '24 hours'
    and not exists (
      select 1 from notifications n
      where n.type = 'assignment.due_soon'
        and n.entity_id = a.id::text
        and n.recipient_id = ud.user_id
    );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function process_due_reminders() from public, anon, authenticated;

-- 2. Auto-publish materi terjadwal
create or replace function publish_scheduled_materials()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update materials
  set status = 'PUBLISHED',
      published_at = coalesce(published_at, now())
  where status = 'DRAFT'
    and scheduled_at is not null
    and scheduled_at <= now();
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function publish_scheduled_materials() from public, anon, authenticated;

-- Jadwal (migrasi jalan sekali per env; kelola ulang via dashboard Cron
-- atau cron.unschedule bila reset dibutuhkan).
select cron.schedule(
  'assignment-due-reminders',
  '*/15 * * * *',
  'select process_due_reminders()'
);

select cron.schedule(
  'material-scheduled-publish',
  '*/5 * * * *',
  'select publish_scheduled_materials()'
);
