-- Clarify policy in comments and error message only; logic unchanged:
-- Grades 1–10: a class may only contain one grade (no mixing).
-- Grades 11–12: may appear together in the same class.

CREATE OR REPLACE FUNCTION public.enrollments_enforce_grade_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  g_new int;
  other_grades int[];
  combined int[];
  distinct_count int;
  all_upper boolean;
BEGIN
  SELECT grade INTO g_new FROM public.students WHERE id = NEW.student;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment references missing student %', NEW.student;
  END IF;

  SELECT COALESCE(ARRAY_AGG(DISTINCT s.grade), ARRAY[]::int[])
  INTO other_grades
  FROM public.enrollments e
  INNER JOIN public.students s ON s.id = e.student
  WHERE e.class = NEW.class
    AND (TG_OP = 'INSERT' OR e.id <> NEW.id);

  combined := other_grades || ARRAY[g_new];

  SELECT COUNT(DISTINCT x)
  INTO distinct_count
  FROM unnest(combined) AS x;

  SELECT bool_and(x IN (11, 12))
  INTO all_upper
  FROM unnest(combined) AS x;

  IF distinct_count = 1 OR all_upper THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'This class may only enroll one grade among grades 1–10, or grades 11 and 12 together (class %, conflicting grades).',
    NEW.class
    USING ERRCODE = 'check_violation';
END;
$$;

COMMENT ON FUNCTION public.enrollments_enforce_grade_rules() IS
  'Enforces: grades 1–10 cannot mix in a class; grades 11 and 12 may mix.';
