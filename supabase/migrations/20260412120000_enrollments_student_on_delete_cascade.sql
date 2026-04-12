-- When a student row is deleted, remove dependent enrollment rows automatically.
-- Apply in Supabase SQL editor or via `supabase db push` if you use the CLI.
-- If your FK is named differently, adjust the constraint name from:
--   Database types: enrollments_student_fkey

alter table public.enrollments
  drop constraint if exists enrollments_student_fkey;

alter table public.enrollments
  add constraint enrollments_student_fkey
  foreign key (student)
  references public.students (id)
  on delete cascade;
