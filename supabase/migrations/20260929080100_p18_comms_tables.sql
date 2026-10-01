-- Fase 8 (P1-801..806): Komunikasi (database.md §11).
-- Pengumuman scoped (org/divisi/kelas + jadwal/kedaluwarsa).
-- Forum + Q&A (accepted_post_id) + komentar materi + DM + realtime messages.

-- 1. announcements
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id) on delete cascade,
  division_id uuid references divisions (id) on delete cascade,
  class_id uuid references classes (id) on delete cascade,
  title text not null,
  body text not null,
  priority text not null default 'NORMAL',
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists announcements_division_id on announcements (division_id);
create index if not exists announcements_class_id on announcements (class_id);
drop trigger if exists announcements_updated_at on announcements;
create trigger announcements_updated_at
  before update on announcements
  for each row execute function set_updated_at();

-- 2. forum_categories (+ seed)
create table if not exists forum_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  position integer not null default 0
);

insert into forum_categories (name, description, position)
values
  ('Umum', 'Diskusi umum Study Club.', 0),
  ('Tanya Jawab', 'Tanya mentor, tandai jawaban diterima.', 1)
on conflict do nothing;

-- 3. forum_threads (+ accepted_post_id untuk Q&A)
create table if not exists forum_threads (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references forum_categories (id) on delete cascade,
  course_id uuid references courses (id) on delete cascade,
  class_id uuid references classes (id) on delete cascade,
  title text not null,
  accepted_post_id uuid,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locked_at timestamptz
);
drop trigger if exists forum_threads_updated_at on forum_threads;
create trigger forum_threads_updated_at
  before update on forum_threads
  for each row execute function set_updated_at();

-- 4. forum_posts (soft delete)
create table if not exists forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references forum_threads (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists forum_posts_thread_id on forum_posts (thread_id);
drop trigger if exists forum_posts_updated_at on forum_posts;
create trigger forum_posts_updated_at
  before update on forum_posts
  for each row execute function set_updated_at();

-- FK accepted_post (setelah kedua tabel ada; null saat dihapus)
do $$ begin
  alter table forum_threads
    add constraint forum_threads_accepted_post_fkey
    foreign key (accepted_post_id) references forum_posts (id) on delete set null;
exception when duplicate_object then null;
end $$;

-- 5. material_comments (soft delete)
create table if not exists material_comments (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists material_comments_material_id on material_comments (material_id);
drop trigger if exists material_comments_updated_at on material_comments;
create trigger material_comments_updated_at
  before update on material_comments
  for each row execute function set_updated_at();

-- 6. conversations + members + messages
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'DIRECT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists conversations_updated_at on conversations;
create trigger conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();

create table if not exists conversation_members (
  conversation_id uuid not null references conversations (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists messages_conversation_id on messages (conversation_id);

-- Realtime untuk pesan (RLS tetap berlaku).
do $$ begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null;
end $$;

-- 7. RLS
alter table announcements enable row level security;
alter table forum_categories enable row level security;
alter table forum_threads enable row level security;
alter table forum_posts enable row level security;
alter table material_comments enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;

-- Pengumuman: org-wide semua; divisi/kelas hanya anggota (+ staf pengelola).
drop policy if exists announcements_select on announcements;
create policy announcements_select on announcements
  for select to authenticated
  using (
    (division_id is null and class_id is null)
    or (division_id is not null and is_division_member(auth.uid(), division_id))
    or (class_id is not null and is_class_member(auth.uid(), class_id))
    or has_permission(auth.uid(), 'announcement.create')
    or has_permission(auth.uid(), 'announcement.update')
  );
drop policy if exists announcements_insert on announcements;
create policy announcements_insert on announcements
  for insert to authenticated
  with check (has_permission(auth.uid(), 'announcement.create'));
drop policy if exists announcements_update on announcements;
create policy announcements_update on announcements
  for update to authenticated
  using (has_permission(auth.uid(), 'announcement.update'))
  with check (has_permission(auth.uid(), 'announcement.update'));
drop policy if exists announcements_delete on announcements;
create policy announcements_delete on announcements
  for delete to authenticated
  using (has_permission(auth.uid(), 'announcement.delete'));

-- Forum: baca semua; tulis create; kunci/hapus moderate.
drop policy if exists forum_categories_select on forum_categories;
create policy forum_categories_select on forum_categories
  for select to authenticated using (true);
drop policy if exists forum_categories_write on forum_categories;
create policy forum_categories_write on forum_categories
  for all to authenticated
  using (has_permission(auth.uid(), 'forum.moderate'))
  with check (has_permission(auth.uid(), 'forum.moderate'));

drop policy if exists forum_threads_select on forum_threads;
create policy forum_threads_select on forum_threads
  for select to authenticated using (true);
drop policy if exists forum_threads_insert on forum_threads;
create policy forum_threads_insert on forum_threads
  for insert to authenticated
  with check (
    has_permission(auth.uid(), 'forum.create')
    and created_by = auth.uid()
  );
drop policy if exists forum_threads_update on forum_threads;
create policy forum_threads_update on forum_threads
  for update to authenticated
  using (has_permission(auth.uid(), 'forum.moderate'))
  with check (has_permission(auth.uid(), 'forum.moderate'));
drop policy if exists forum_threads_delete on forum_threads;
create policy forum_threads_delete on forum_threads
  for delete to authenticated
  using (has_permission(auth.uid(), 'forum.moderate'));

-- Postingan: sembunyikan yang soft-delete kecuali moderator; tulis sendiri.
drop policy if exists forum_posts_select on forum_posts;
create policy forum_posts_select on forum_posts
  for select to authenticated
  using (
    deleted_at is null
    or has_permission(auth.uid(), 'forum.moderate')
  );
drop policy if exists forum_posts_insert on forum_posts;
create policy forum_posts_insert on forum_posts
  for insert to authenticated
  with check (
    has_permission(auth.uid(), 'forum.create')
    and author_id = auth.uid()
  );
drop policy if exists forum_posts_update on forum_posts;
create policy forum_posts_update on forum_posts
  for update to authenticated
  using (
    (author_id = auth.uid() and deleted_at is null)
    or has_permission(auth.uid(), 'forum.moderate')
  )
  with check (
    author_id = auth.uid()
    or has_permission(auth.uid(), 'forum.moderate')
  );
drop policy if exists forum_posts_delete on forum_posts;
create policy forum_posts_delete on forum_posts
  for delete to authenticated
  using (has_permission(auth.uid(), 'forum.moderate'));

-- Komentar materi: baca semua; tulis/modernisasi sendiri + moderator.
drop policy if exists material_comments_select on material_comments;
create policy material_comments_select on material_comments
  for select to authenticated
  using (
    deleted_at is null
    or has_permission(auth.uid(), 'forum.moderate')
  );
drop policy if exists material_comments_insert on material_comments;
create policy material_comments_insert on material_comments
  for insert to authenticated
  with check (author_id = auth.uid());
drop policy if exists material_comments_update on material_comments;
create policy material_comments_update on material_comments
  for update to authenticated
  using (
    (author_id = auth.uid() and deleted_at is null)
    or has_permission(auth.uid(), 'forum.moderate')
  )
  with check (
    author_id = auth.uid()
    or has_permission(auth.uid(), 'forum.moderate')
  );
drop policy if exists material_comments_delete on material_comments;
create policy material_comments_delete on material_comments
  for delete to authenticated
  using (has_permission(auth.uid(), 'forum.moderate'));

-- DM: hanya anggota percakapan; tulis harus anggota + pengirim sendiri.
drop policy if exists conversations_select on conversations;
create policy conversations_select on conversations
  for select to authenticated
  using (
    exists (
      select 1 from conversation_members cm
      where cm.conversation_id = id and cm.user_id = auth.uid()
    )
  );
drop policy if exists conversations_insert on conversations;
create policy conversations_insert on conversations
  for insert to authenticated
  with check (true);

drop policy if exists conversation_members_select on conversation_members;
create policy conversation_members_select on conversation_members
  for select to authenticated
  using (user_id = auth.uid());
drop policy if exists conversation_members_insert on conversation_members;
create policy conversation_members_insert on conversation_members
  for insert to authenticated
  with check (true);

drop policy if exists messages_select on messages;
create policy messages_select on messages
  for select to authenticated
  using (
    exists (
      select 1 from conversation_members cm
      where cm.conversation_id = conversation_id and cm.user_id = auth.uid()
    )
  );
drop policy if exists messages_insert on messages;
create policy messages_insert on messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversation_members cm
      where cm.conversation_id = conversation_id and cm.user_id = auth.uid()
    )
  );

-- Grants
grant select, insert, update, delete on announcements to authenticated;
grant select, insert, update, delete on forum_categories to authenticated;
grant select, insert, update, delete on forum_threads to authenticated;
grant select, insert, update, delete on forum_posts to authenticated;
grant select, insert, update, delete on material_comments to authenticated;
grant select, insert on conversations to authenticated;
grant select, insert on conversation_members to authenticated;
grant select, insert on messages to authenticated;
grant all on announcements, forum_categories, forum_threads, forum_posts,
  material_comments, conversations, conversation_members, messages to service_role;
