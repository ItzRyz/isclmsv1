-- P1-310: Roadmaps — visualisasi prasyarat + status selesai (database.md §5).

create table if not exists roadmaps (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references divisions (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status content_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (division_id, slug)
);
drop trigger if exists roadmaps_updated_at on roadmaps;
create trigger roadmaps_updated_at
  before update on roadmaps
  for each row execute function set_updated_at();

create table if not exists roadmap_nodes (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references roadmaps (id) on delete cascade,
  course_id uuid references courses (id) on delete cascade,
  module_id uuid references modules (id) on delete cascade,
  material_id uuid references materials (id) on delete cascade,
  title text not null,
  position integer not null default 0,
  x integer,
  y integer,
  created_at timestamptz not null default now(),
  check (
    (course_id is not null)::int
    + (module_id is not null)::int
    + (material_id is not null)::int <= 1
  )
);
create index if not exists roadmap_nodes_roadmap_id on roadmap_nodes (roadmap_id);

create table if not exists roadmap_edges (
  from_node_id uuid not null references roadmap_nodes (id) on delete cascade,
  to_node_id uuid not null references roadmap_nodes (id) on delete cascade,
  edge_type text not null default 'PREREQUISITE',
  primary key (from_node_id, to_node_id),
  check (from_node_id <> to_node_id)
);

-- RLS: baca published atau staf roadmap.*; tulis roadmap.manage.
alter table roadmaps enable row level security;
alter table roadmap_nodes enable row level security;
alter table roadmap_edges enable row level security;

drop policy if exists roadmaps_select on roadmaps;
create policy roadmaps_select on roadmaps
  for select to authenticated
  using (
    status = 'PUBLISHED'
    or has_permission(auth.uid(), 'roadmap.manage')
  );
drop policy if exists roadmaps_write on roadmaps;
create policy roadmaps_write on roadmaps
  for all to authenticated
  using (has_permission(auth.uid(), 'roadmap.manage'))
  with check (has_permission(auth.uid(), 'roadmap.manage'));

drop policy if exists roadmap_nodes_select on roadmap_nodes;
create policy roadmap_nodes_select on roadmap_nodes
  for select to authenticated using (true);
drop policy if exists roadmap_nodes_write on roadmap_nodes;
create policy roadmap_nodes_write on roadmap_nodes
  for all to authenticated
  using (has_permission(auth.uid(), 'roadmap.manage'))
  with check (has_permission(auth.uid(), 'roadmap.manage'));

drop policy if exists roadmap_edges_select on roadmap_edges;
create policy roadmap_edges_select on roadmap_edges
  for select to authenticated using (true);
drop policy if exists roadmap_edges_write on roadmap_edges;
create policy roadmap_edges_write on roadmap_edges
  for all to authenticated
  using (has_permission(auth.uid(), 'roadmap.manage'))
  with check (has_permission(auth.uid(), 'roadmap.manage'));

grant select, insert, update, delete on roadmaps to authenticated;
grant select, insert, update, delete on roadmap_nodes to authenticated;
grant select, insert, update, delete on roadmap_edges to authenticated;
grant all on roadmaps, roadmap_nodes, roadmap_edges to service_role;
