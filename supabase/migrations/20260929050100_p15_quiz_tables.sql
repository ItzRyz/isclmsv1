-- Fase 5 (P1-501..506): Quiz — bank soal, quiz, attempts, jawaban (database.md §7).
-- Skor TIDAK PERNAH dari browser: is_correct/points_awarded hanya ditulis server.
-- Opsi jawaban terbaca authenticated, tapi app selalu men-strip kunci jawaban
-- sebelum render ke klien.

-- 1. quizzes
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  module_id uuid references modules (id) on delete set null,
  material_id uuid references materials (id) on delete set null,
  title text not null,
  description text,
  type text not null default 'PRACTICE',
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds > 0),
  max_attempts integer not null default 1 check (max_attempts >= 1),
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  passing_score numeric check (passing_score is null or passing_score >= 0),
  is_graded boolean not null default true,
  available_from timestamptz,
  due_at timestamptz,
  status content_status not null default 'DRAFT',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quizzes_course_id on quizzes (course_id);
drop trigger if exists quizzes_updated_at on quizzes;
create trigger quizzes_updated_at
  before update on quizzes
  for each row execute function set_updated_at();

-- 2. questions
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  question_type text not null default 'SINGLE_CHOICE'
    check (question_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE')),
  prompt text not null,
  explanation text,
  difficulty text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists questions_updated_at on questions;
create trigger questions_updated_at
  before update on questions
  for each row execute function set_updated_at();

-- 3. question_options
create table if not exists question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions (id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  position integer not null default 0
);
create index if not exists question_options_question_id on question_options (question_id);

-- 4. quiz_questions
create table if not exists quiz_questions (
  quiz_id uuid not null references quizzes (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  position integer not null default 0,
  points numeric not null default 1 check (points >= 0),
  primary key (quiz_id, question_id)
);

-- 5. quiz_attempts
create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  attempt_number integer not null check (attempt_number >= 1),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric check (score is null or score >= 0),
  status text not null default 'IN_PROGRESS'
    check (status in ('IN_PROGRESS', 'SUBMITTED', 'GRADED', 'EXPIRED')),
  created_at timestamptz not null default now()
);
create index if not exists quiz_attempts_quiz_id on quiz_attempts (quiz_id);
create index if not exists quiz_attempts_user_id on quiz_attempts (user_id);

-- 6. quiz_answers
create table if not exists quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references quiz_attempts (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  selected_option_ids jsonb not null default '[]',
  is_correct boolean,
  points_awarded numeric check (points_awarded is null or points_awarded >= 0),
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- 7. RLS
alter table quizzes enable row level security;
alter table questions enable row level security;
alter table question_options enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_attempts enable row level security;
alter table quiz_answers enable row level security;

-- quizzes: baca bila PUBLISHED dalam jendela + staf; tulis quiz.*.
drop policy if exists quizzes_select on quizzes;
create policy quizzes_select on quizzes
  for select to authenticated
  using (
    (
      status = 'PUBLISHED'
      and (available_from is null or available_from <= now())
    )
    or has_permission(auth.uid(), 'quiz.create')
    or has_permission(auth.uid(), 'quiz.update')
    or has_permission(auth.uid(), 'quiz.delete')
    or has_permission(auth.uid(), 'quiz.grade')
  );
drop policy if exists quizzes_insert on quizzes;
create policy quizzes_insert on quizzes
  for insert to authenticated
  with check (has_permission(auth.uid(), 'quiz.create'));
drop policy if exists quizzes_update on quizzes;
create policy quizzes_update on quizzes
  for update to authenticated
  using (has_permission(auth.uid(), 'quiz.update'))
  with check (has_permission(auth.uid(), 'quiz.update'));
drop policy if exists quizzes_delete on quizzes;
create policy quizzes_delete on quizzes
  for delete to authenticated
  using (has_permission(auth.uid(), 'quiz.delete'));

-- bank soal: baca authenticated (kunci disaring app), tulis quiz.create/update.
drop policy if exists questions_select on questions;
create policy questions_select on questions
  for select to authenticated using (true);
drop policy if exists questions_write on questions;
create policy questions_write on questions
  for all to authenticated
  using (
    has_permission(auth.uid(), 'quiz.create')
    or has_permission(auth.uid(), 'quiz.update')
  )
  with check (
    has_permission(auth.uid(), 'quiz.create')
    or has_permission(auth.uid(), 'quiz.update')
  );

drop policy if exists question_options_select on question_options;
create policy question_options_select on question_options
  for select to authenticated using (true);
drop policy if exists question_options_write on question_options;
create policy question_options_write on question_options
  for all to authenticated
  using (
    has_permission(auth.uid(), 'quiz.create')
    or has_permission(auth.uid(), 'quiz.update')
  )
  with check (
    has_permission(auth.uid(), 'quiz.create')
    or has_permission(auth.uid(), 'quiz.update')
  );

drop policy if exists quiz_questions_select on quiz_questions;
create policy quiz_questions_select on quiz_questions
  for select to authenticated using (true);
drop policy if exists quiz_questions_write on quiz_questions;
create policy quiz_questions_write on quiz_questions
  for all to authenticated
  using (
    has_permission(auth.uid(), 'quiz.create')
    or has_permission(auth.uid(), 'quiz.update')
  )
  with check (
    has_permission(auth.uid(), 'quiz.create')
    or has_permission(auth.uid(), 'quiz.update')
  );

-- attempts: milik sendiri + penilai.
drop policy if exists quiz_attempts_select on quiz_attempts;
create policy quiz_attempts_select on quiz_attempts
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'quiz.grade')
  );
drop policy if exists quiz_attempts_insert on quiz_attempts;
create policy quiz_attempts_insert on quiz_attempts
  for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists quiz_attempts_update on quiz_attempts;
create policy quiz_attempts_update on quiz_attempts
  for update to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'quiz.grade')
  )
  with check (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'quiz.grade')
  );

-- answers: hanya via attempt milik sendiri / penilai (subquery tepat).
drop policy if exists quiz_answers_select on quiz_answers;
create policy quiz_answers_select on quiz_answers
  for select to authenticated
  using (
    exists (
      select 1 from quiz_attempts a
      where a.id = attempt_id
        and (
          a.user_id = auth.uid()
          or has_permission(auth.uid(), 'quiz.grade')
        )
    )
  );
drop policy if exists quiz_answers_write on quiz_answers;
create policy quiz_answers_write on quiz_answers
  for all to authenticated
  using (
    exists (
      select 1 from quiz_attempts a
      where a.id = attempt_id
        and (
          a.user_id = auth.uid()
          or has_permission(auth.uid(), 'quiz.grade')
        )
    )
  )
  with check (
    exists (
      select 1 from quiz_attempts a
      where a.id = attempt_id
        and (
          a.user_id = auth.uid()
          or has_permission(auth.uid(), 'quiz.grade')
        )
    )
  );

-- Grants
grant select, insert, update, delete on quizzes to authenticated;
grant select, insert, update, delete on questions to authenticated;
grant select, insert, update, delete on question_options to authenticated;
grant select, insert, update, delete on quiz_questions to authenticated;
grant select, insert, update on quiz_attempts to authenticated;
grant select, insert, update, delete on quiz_answers to authenticated;
grant all on quizzes, questions, question_options, quiz_questions,
  quiz_attempts, quiz_answers to service_role;
