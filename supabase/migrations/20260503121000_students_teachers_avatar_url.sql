-- Public URLs for roster photos live in storage (profiles bucket); these columns store the URL.

alter table public.students
  add column if not exists avatar_url text;

alter table public.teachers
  add column if not exists avatar_url text;
