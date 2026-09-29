-- Fase 7 (P1-701..709): Assessment — komponen, nilai, skala, poin,
-- ranking, rapor (database.md §9, §10).
-- Nilai dihitung server (raw -> normalized -> weighted); audit tiap tulis.
-- Poin hanya via insert (koreksi = transaksi kompensasi, tanpa ubah riwayat).

-- 1. grade_components
create table if not exists grade_components (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  code text not null,
  name text not null,
  max_score numeric not null default 100 check (max_score > 0),
  default_weight numeric not null default 0 check (default_weight >= 0),
  unique (organization_id, code)
);

-- 2. grade_weights (per periode, opsional per course/divisi)
create table if not exists grade_weights (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references academic_periods (id) on delete cascade,
  course_id uuid references courses (id) on delete cascade,
  division_id uuid references divisions (id) on delete cascade,
  grade_component_id uuid not null references grade_components (id) on delete cascade,
  weight numeric not null check (weight >= 0),
  created_at timestamptz not null default now(),
  unique (academic_period_id, course_id, division_id, grade_component_id)
);

-- 3. grades
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  academic_period_id uuid not null references academic_periods (id) on delete cascade,
  course_id uuid references courses (id) on delete cascade,
  grade_component_id uuid not null references grade_components (id) on delete cascade,
  source_type text not null,
  source_id uuid,
  raw_score numeric not null check (raw_score >= 0),
  normalized_score numeric not null,
  weight_applied numeric not null default 0,
  weighted_score numeric not null default 0,
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists grades_user_id on grades (user_id);
create index if not exists grades_academic_period_id on grades (academic_period_id);
drop trigger if exists grades_updated_at on grades;
create trigger grades_updated_at
  before update on grades
  for each row execute function set_updated_at();

-- 4. grade_scales (is_passing menandai batas KKM/KKTP)
create table if not exists grade_scales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  code text not null,
  letter text not null,
  min_score numeric not null,
  max_score numeric not null,
  is_passing boolean not null default true,
  remark text,
  check (min_score <= max_score)
);

-- 5. report_cards + items
create table if not exists report_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  academic_period_id uuid not null references academic_periods (id) on delete cascade,
  total_score numeric not null,
  grade_letter text not null,
  remark text,
  published_at timestamptz,
  generated_at timestamptz not null default now(),
  unique (user_id, academic_period_id)
);

create table if not exists report_card_items (
  id uuid primary key default gen_random_uuid(),
  report_card_id uuid not null references report_cards (id) on delete cascade,
  grade_component_id uuid not null references grade_components (id) on delete cascade,
  score numeric not null,
  weight numeric not null default 0,
  weighted_score numeric not null default 0
);

-- 6. point_transactions (append-only: tanpa UPDATE/DELETE untuk siapa pun)
create table if not exists point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  amount integer not null check (amount <> 0),
  point_type text not null,
  source_type text not null,
  source_id uuid,
  description text not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists point_transactions_user_id on point_transactions (user_id);

-- 7. ranking_periods
create table if not exists ranking_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  academic_period_id uuid references academic_periods (id) on delete set null,
  type text not null default 'SEMESTER',
  name text not null,
  start_date date,
  end_date date,
  metric text not null default 'POINTS',
  status content_status not null default 'DRAFT',
  created_at timestamptz not null default now()
);

-- 8. ranking_entries
create table if not exists ranking_entries (
  id uuid primary key default gen_random_uuid(),
  ranking_period_id uuid not null references ranking_periods (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  rank integer not null check (rank >= 1),
  score numeric not null,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  unique (ranking_period_id, user_id)
);

-- 9. RLS
alter table grade_components enable row level security;
alter table grade_weights enable row level security;
alter table grades enable row level security;
alter table grade_scales enable row level security;
alter table report_cards enable row level security;
alter table report_card_items enable row level security;
alter table point_transactions enable row level security;
alter table ranking_periods enable row level security;
alter table ranking_entries enable row level security;

-- Komponen/bobot/skala: baca authenticated; tulis grade.create/update.
drop policy if exists grade_components_select on grade_components;
create policy grade_components_select on grade_components
  for select to authenticated using (true);
drop policy if exists grade_components_write on grade_components;
create policy grade_components_write on grade_components
  for all to authenticated
  using (
    has_permission(auth.uid(), 'grade.create')
    or has_permission(auth.uid(), 'grade.update')
  )
  with check (
    has_permission(auth.uid(), 'grade.create')
    or has_permission(auth.uid(), 'grade.update')
  );

drop policy if exists grade_weights_select on grade_weights;
create policy grade_weights_select on grade_weights
  for select to authenticated using (true);
drop policy if exists grade_weights_write on grade_weights;
create policy grade_weights_write on grade_weights
  for all to authenticated
  using (
    has_permission(auth.uid(), 'grade.create')
    or has_permission(auth.uid(), 'grade.update')
  )
  with check (
    has_permission(auth.uid(), 'grade.create')
    or has_permission(auth.uid(), 'grade.update')
  );

drop policy if exists grade_scales_select on grade_scales;
create policy grade_scales_select on grade_scales
  for select to authenticated using (true);
drop policy if exists grade_scales_write on grade_scales;
create policy grade_scales_write on grade_scales
  for all to authenticated
  using (
    has_permission(auth.uid(), 'grade.create')
    or has_permission(auth.uid(), 'grade.update')
  )
  with check (
    has_permission(auth.uid(), 'grade.create')
    or has_permission(auth.uid(), 'grade.update')
  );

-- Nilai: milik sendiri + penilai; tulis penilai.
drop policy if exists grades_select on grades;
create policy grades_select on grades
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'grade.view')
    or has_permission(auth.uid(), 'grade.create')
    or has_permission(auth.uid(), 'grade.update')
  );
drop policy if exists grades_insert on grades;
create policy grades_insert on grades
  for insert to authenticated
  with check (has_permission(auth.uid(), 'grade.create'));
drop policy if exists grades_update on grades;
create policy grades_update on grades
  for update to authenticated
  using (has_permission(auth.uid(), 'grade.update'))
  with check (has_permission(auth.uid(), 'grade.update'));

-- Rapor: milik sendiri + grade.view; tulis grade.publish.
drop policy if exists report_cards_select on report_cards;
create policy report_cards_select on report_cards
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'grade.view')
  );
drop policy if exists report_cards_write on report_cards;
create policy report_cards_write on report_cards
  for all to authenticated
  using (has_permission(auth.uid(), 'grade.publish'))
  with check (has_permission(auth.uid(), 'grade.publish'));

drop policy if exists report_card_items_select on report_card_items;
create policy report_card_items_select on report_card_items
  for select to authenticated using (true);
drop policy if exists report_card_items_write on report_card_items;
create policy report_card_items_write on report_card_items
  for all to authenticated
  using (has_permission(auth.uid(), 'grade.publish'))
  with check (has_permission(auth.uid(), 'grade.publish'));

-- Poin: baca sendiri + point.view; tulis point.manage; TANPA update/delete.
drop policy if exists point_transactions_select on point_transactions;
create policy point_transactions_select on point_transactions
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'point.view')
    or has_permission(auth.uid(), 'point.manage')
  );
drop policy if exists point_transactions_insert on point_transactions;
create policy point_transactions_insert on point_transactions
  for insert to authenticated
  with check (has_permission(auth.uid(), 'point.manage'));

-- Ranking: baca authenticated; tulis ranking.manage.
drop policy if exists ranking_periods_select on ranking_periods;
create policy ranking_periods_select on ranking_periods
  for select to authenticated using (true);
drop policy if exists ranking_periods_write on ranking_periods;
create policy ranking_periods_write on ranking_periods
  for all to authenticated
  using (has_permission(auth.uid(), 'ranking.manage'))
  with check (has_permission(auth.uid(), 'ranking.manage'));

drop policy if exists ranking_entries_select on ranking_entries;
create policy ranking_entries_select on ranking_entries
  for select to authenticated using (true);
drop policy if exists ranking_entries_write on ranking_entries;
create policy ranking_entries_write on ranking_entries
  for all to authenticated
  using (has_permission(auth.uid(), 'ranking.manage'))
  with check (has_permission(auth.uid(), 'ranking.manage'));

-- Grants (tanpa update/delete untuk point_transactions!)
grant select, insert, update, delete on grade_components to authenticated;
grant select, insert, update, delete on grade_weights to authenticated;
grant select, insert, update on grades to authenticated;
grant select, insert, update, delete on grade_scales to authenticated;
grant select, insert, update, delete on report_cards to authenticated;
grant select, insert, update, delete on report_card_items to authenticated;
grant select, insert on point_transactions to authenticated;
grant select, insert, update, delete on ranking_periods to authenticated;
grant select, insert, update, delete on ranking_entries to authenticated;
grant all on grade_components, grade_weights, grades, grade_scales,
  report_cards, report_card_items, point_transactions,
  ranking_periods, ranking_entries to service_role;
