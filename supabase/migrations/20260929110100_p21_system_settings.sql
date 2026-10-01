-- Fase 11 (P1-1104): System settings — key/value JSON terpusat.
create table if not exists system_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now()
);

alter table system_settings enable row level security;

drop policy if exists system_settings_select on system_settings;
create policy system_settings_select on system_settings
  for select to authenticated
  using (
    has_permission(auth.uid(), 'settings.view')
    or has_permission(auth.uid(), 'settings.manage')
  );

drop policy if exists system_settings_write on system_settings;
create policy system_settings_write on system_settings
  for all to authenticated
  using (has_permission(auth.uid(), 'settings.manage'))
  with check (has_permission(auth.uid(), 'settings.manage'));

grant select, insert, update, delete on system_settings to authenticated;
grant all on system_settings to service_role;

-- Default awal (idempoten).
insert into system_settings (key, value)
values
  ('attendance.on_time_grace_minutes', '{"minutes": 15}'),
  ('attendance.default_radius_meters', '{"meters": 100}'),
  ('grading.default_passing_score', '{"score": 70}'),
  ('notifications.default_preferences', '{"in_app": true, "email": true}')
on conflict (key) do nothing;
