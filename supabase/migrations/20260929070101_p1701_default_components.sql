-- P1-701: seed komponen nilai default untuk organisasi study-club.
insert into grade_components (organization_id, code, name, max_score, default_weight)
select o.id, v.code, v.name, v.max_score, v.default_weight
from organizations o
cross join (values
  ('ASSIGNMENT', 'Tugas', 100, 30),
  ('QUIZ', 'Kuis', 100, 20),
  ('MIDTERM', 'UTS', 100, 20),
  ('FINAL', 'UAS', 100, 20),
  ('ATTENDANCE', 'Kehadiran', 100, 10)
) as v (code, name, max_score, default_weight)
where o.slug = 'study-club'
on conflict (organization_id, code) do update set
  name = excluded.name,
  max_score = excluded.max_score,
  default_weight = excluded.default_weight;
