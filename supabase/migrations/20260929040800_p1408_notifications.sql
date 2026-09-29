-- P1-408: Notifications (dipakai dulu untuk tugas; fondasi koms Fase 8).
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_id on notifications (recipient_id);
create index if not exists notifications_read_at on notifications (read_at);

create table if not exists notification_preferences (
  user_id uuid not null references profiles (id) on delete cascade,
  event_type text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, event_type)
);

alter table notifications enable row level security;
alter table notification_preferences enable row level security;

-- Baca/tandai milik sendiri; tulis via jalur app ber-permission.
drop policy if exists notifications_select_own on notifications;
create policy notifications_select_own on notifications
  for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists notifications_insert on notifications;
create policy notifications_insert on notifications
  for insert to authenticated
  with check (true);

drop policy if exists notification_preferences_all on notification_preferences;
create policy notification_preferences_all on notification_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on notifications to authenticated;
grant select, insert, update, delete on notification_preferences to authenticated;
grant all on notifications, notification_preferences to service_role;
