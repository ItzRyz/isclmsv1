-- P0-1401: seed data demo staging (idempotent, UUID tetap).
-- Dijalankan sebelum scripts/staging-seed.ts (user via admin API).
-- Org + divisi sudah ada dari migrasi p0105 (dirujuk via slug/code).

insert into academic_periods (id, organization_id, name, code, start_date, end_date)
select
  '11111111-1111-1111-8111-000000000001',
  o.id,
  'Semester Ganjil 2026/2027',
  '2026-1-GANJIL',
  '2026-08-01',
  '2027-01-31'
from organizations o
where o.slug = 'study-club'
on conflict (code) do update set
  name = excluded.name,
  start_date = excluded.start_date,
  end_date = excluded.end_date;

insert into batches (id, organization_id, name, code, start_date, end_date)
select
  '11111111-1111-1111-8111-000000000002',
  o.id,
  'Batch 2026',
  'BATCH-2026',
  '2026-08-01',
  '2027-01-31'
from organizations o
where o.slug = 'study-club'
on conflict (code) do update set name = excluded.name;

insert into classes (id, division_id, batch_id, academic_period_id, name, code, capacity)
select v.id::uuid, d.id, b.id, p.id, v.name, v.code, v.capacity
from organizations o
join divisions d on d.organization_id = o.id
join academic_periods p on p.code = '2026-1-GANJIL'
join batches b on b.code = 'BATCH-2026'
cross join (values
  ('11111111-1111-1111-8111-000000000011', 'WEB', 'Kelas Web A', 'WEB-A-2026', 30),
  ('11111111-1111-1111-8111-000000000012', 'ML', 'Kelas ML A', 'ML-A-2026', 30),
  ('11111111-1111-1111-8111-000000000013', 'UIUX', 'Kelas UI/UX A', 'UIUX-A-2026', 30)
) as v (id, division_code, name, code, capacity)
where o.slug = 'study-club'
  and d.code = v.division_code
on conflict (code) do update set name = excluded.name;

insert into grade_scales (organization_id, code, letter, min_score, max_score, is_passing)
select o.id, v.code, v.letter, v.min_score, v.max_score, v.is_passing
from organizations o
cross join (values
  ('A', 'A', 90, 100, true),
  ('B', 'B', 80, 89, true),
  ('C', 'C', 70, 79, true),
  ('D', 'D', 0, 69, false)
) as v (code, letter, min_score, max_score, is_passing)
where o.slug = 'study-club'
  and not exists (
    select 1 from grade_scales gs
    where gs.organization_id = o.id and gs.code = v.code
  );

insert into courses (id, division_id, name, slug, description, status, difficulty, estimated_hours, published_at)
select v.id::uuid, d.id, v.name, v.slug, v.description, 'PUBLISHED', v.difficulty, v.estimated_hours, now()
from organizations o
join divisions d on d.organization_id = o.id
cross join (values
  ('11111111-1111-1111-8111-000000000021', 'WEB', 'Fundamentals of Web Development', 'web-fundamentals', 'HTML, CSS, dan JavaScript untuk pemula.', 'BEGINNER', 40),
  ('11111111-1111-1111-8111-000000000022', 'ML', 'Introduction to Machine Learning', 'ml-intro', 'Regresi, klasifikasi, dan evaluasi model.', 'BEGINNER', 50),
  ('11111111-1111-1111-8111-000000000023', 'UIUX', 'Design Thinking Fundamentals', 'design-thinking', 'Empathize, define, ideate, prototype, test.', 'BEGINNER', 30)
) as v (id, division_code, name, slug, description, difficulty, estimated_hours)
where o.slug = 'study-club'
  and d.code = v.division_code
on conflict (division_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = 'PUBLISHED';

insert into modules (id, course_id, title, slug, position, status)
select v.id::uuid, c.id, v.title, v.slug, v.position, 'PUBLISHED'
from courses c
cross join (values
  ('11111111-1111-1111-8111-000000000031', 'web-fundamentals', 'Modul 1: HTML Dasar', 'web-modul-1', 0),
  ('11111111-1111-1111-8111-000000000032', 'web-fundamentals', 'Modul 2: CSS Layout', 'web-modul-2', 1),
  ('11111111-1111-1111-8111-000000000033', 'ml-intro', 'Modul 1: Regresi Linier', 'ml-modul-1', 0),
  ('11111111-1111-1111-8111-000000000034', 'ml-intro', 'Modul 2: Klasifikasi', 'ml-modul-2', 1),
  ('11111111-1111-1111-8111-000000000035', 'design-thinking', 'Modul 1: Empathize & Define', 'uiux-modul-1', 0),
  ('11111111-1111-1111-8111-000000000036', 'design-thinking', 'Modul 2: Prototype & Test', 'uiux-modul-2', 1)
) as v (id, course_slug, title, slug, position)
where c.slug = v.course_slug
on conflict (course_id, position) do update set title = excluded.title;

insert into materials (id, module_id, title, slug, type, content_text, estimated_minutes, is_required, status, published_at)
select v.id::uuid, m.id, v.title, v.slug, 'TEXT', v.content, v.estimated_minutes, v.is_required, 'PUBLISHED', now()
from modules m
cross join (values
  ('11111111-1111-1111-8111-000000000041', 'web-modul-1', 'Apa itu HTML?', 'web-1-1', 'HTML adalah bahasa markup untuk struktur halaman web.', 20, true),
  ('11111111-1111-1111-8111-000000000042', 'web-modul-1', 'Tag & Atribut', 'web-1-2', 'Tag membungkus elemen; atribut memberi metadata.', 25, true),
  ('11111111-1111-1111-8111-000000000043', 'web-modul-2', 'Box Model', 'web-2-1', 'Setiap elemen adalah kotak: content, padding, border, margin.', 30, true),
  ('11111111-1111-1111-8111-000000000044', 'web-modul-2', 'Flexbox', 'web-2-2', 'Flexbox untuk layout satu dimensi.', 35, false),
  ('11111111-1111-1111-8111-000000000045', 'ml-modul-1', 'Apa itu Regresi?', 'ml-1-1', 'Regresi memetakan input ke output kontinu.', 25, true),
  ('11111111-1111-1111-8111-000000000046', 'ml-modul-1', 'Gradient Descent', 'ml-1-2', 'Optimasi iteratif untuk meminimalkan loss.', 30, true),
  ('11111111-1111-1111-8111-000000000047', 'ml-modul-2', 'Klasifikasi & Decision Boundary', 'ml-2-1', 'Klasifikasi memisahkan kelas dengan batas keputusan.', 30, true),
  ('11111111-1111-1111-8111-000000000048', 'ml-modul-2', 'Overfitting', 'ml-2-2', 'Overfitting: model hafal data latih, gagal generalisasi.', 25, false),
  ('11111111-1111-1111-8111-000000000049', 'uiux-modul-1', 'Empathize: Riset Pengguna', 'uiux-1-1', 'Wawancara dan observasi untuk memahami pengguna.', 25, true),
  ('11111111-1111-1111-8111-000000000050', 'uiux-modul-1', 'Define: Problem Statement', 'uiux-1-2', 'Merumuskan masalah yang tepat sebelum membuat solusi.', 20, true),
  ('11111111-1111-1111-8111-000000000051', 'uiux-modul-2', 'Prototyping', 'uiux-2-1', 'Prototipe cepat untuk menguji asumsi.', 30, true),
  ('11111111-1111-1111-8111-000000000052', 'uiux-modul-2', 'Usability Testing', 'uiux-2-2', 'Uji dengan 5 pengguna untuk menemukan masalah utama.', 25, false)
) as v (id, module_slug, title, slug, content, estimated_minutes, is_required)
where m.slug = v.module_slug
on conflict (module_id, slug) do update set title = excluded.title;

insert into material_prerequisites (material_id, prerequisite_material_id)
select t.id, s.id
from materials s
join materials t on t.slug = 'web-2-1'
where s.slug = 'web-1-2'
on conflict do nothing;

insert into quizzes (id, course_id, title, description, type, max_attempts, is_graded, status)
select v.id::uuid, c.id, v.title, v.description, 'PRACTICE', 2, true, 'PUBLISHED'
from courses c
cross join (values
  ('11111111-1111-1111-8111-000000000061', 'web-fundamentals', 'Quiz HTML Dasar', 'Pemahaman tag dan atribut HTML.')
) as v (id, course_slug, title, description)
where c.slug = v.course_slug
  and not exists (
    select 1 from quizzes q where q.course_id = c.id and q.title = v.title
  );

insert into questions (id, question_type, prompt, explanation, difficulty)
values
  ('11111111-1111-1111-8111-000000000071', 'SINGLE_CHOICE', 'Tag mana yang membuat teks menjadi paragraf?', 'Tag <p> adalah paragraf.', 'EASY'),
  ('11111111-1111-1111-8111-000000000072', 'TRUE_FALSE', 'Atribut href dipakai pada tag <a>.', 'Benar: <a href="..."> untuk tautan.', 'EASY')
on conflict do nothing;

insert into question_options (id, question_id, option_text, is_correct, position)
values
  ('11111111-1111-1111-8111-000000000081', '11111111-1111-1111-8111-000000000071', '<paragraf>', false, 0),
  ('11111111-1111-1111-8111-000000000082', '11111111-1111-1111-8111-000000000071', '<p>', true, 1),
  ('11111111-1111-1111-8111-000000000083', '11111111-1111-1111-8111-000000000071', '<text>', false, 2),
  ('11111111-1111-1111-8111-000000000084', '11111111-1111-1111-8111-000000000072', 'Benar', true, 0),
  ('11111111-1111-1111-8111-000000000085', '11111111-1111-1111-8111-000000000072', 'Salah', false, 1)
on conflict do nothing;

insert into quiz_questions (quiz_id, question_id, position, points)
select q.id, s.id, v.position, v.points
from quizzes q
cross join questions s
cross join (values
  ('11111111-1111-1111-8111-000000000071', 0, 1),
  ('11111111-1111-1111-8111-000000000072', 1, 1)
) as v (question_id, position, points)
where q.title = 'Quiz HTML Dasar'
  and s.id = v.question_id::uuid
on conflict do nothing;

