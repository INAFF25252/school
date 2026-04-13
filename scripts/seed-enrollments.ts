import { faker } from "@faker-js/faker";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { enrollmentGradesCompatible } from "../lib/enrollment-grade-rules";

type StudentRow = Database["public"]["Tables"]["students"]["Row"];

/**
 * One enrollment per student (each student in at most one class).
 * Grade rules (enforced in DB): grades 1–10 = single grade per class; 11–12 may mix.
 */
function canAddToClass(existingGrades: Set<number>, grade: number): boolean {
  return enrollmentGradesCompatible(existingGrades, grade);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended for inserts) or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
    process.exit(1);
  }

  const supabase = createClient<Database>(url, key);

  const [{ data: students, error: studentsError }, { data: classes, error: classesError }] =
    await Promise.all([
      supabase.from("students").select("id, grade"),
      supabase.from("classes").select("id"),
    ]);

  if (studentsError || classesError) {
    console.error(studentsError ?? classesError);
    process.exit(1);
  }

  const studentRows = (students ?? []) as StudentRow[];
  const classIds = classes?.map((c) => c.id) ?? [];

  if (studentRows.length === 0 || classIds.length === 0) {
    console.error("Need at least one student and one class to seed enrollments.");
    process.exit(1);
  }

  const { error: deleteError, count: deletedCount } = await supabase
    .from("enrollments")
    .delete({ count: "exact" })
    .neq("id", -1);

  if (deleteError) {
    console.error(deleteError);
    process.exit(1);
  }

  const shuffledClasses = faker.helpers.shuffle([...classIds]);
  const shuffledStudents = faker.helpers.shuffle([...studentRows]);

  const classGrades = new Map<number, Set<number>>();
  for (const c of shuffledClasses) {
    classGrades.set(c, new Set());
  }

  const assignedStudents = new Set<number>();
  const rows: Database["public"]["Tables"]["enrollments"]["Insert"][] = [];

  let progress = true;
  while (progress) {
    progress = false;
    for (const classId of shuffledClasses) {
      const existing = classGrades.get(classId)!;
      const next = shuffledStudents.find(
        (s) => !assignedStudents.has(s.id) && canAddToClass(existing, s.grade),
      );
      if (next) {
        rows.push({ student: next.id, class: classId });
        assignedStudents.add(next.id);
        existing.add(next.grade);
        progress = true;
      }
    }
  }

  const unassigned = studentRows.filter((s) => !assignedStudents.has(s.id));
  if (unassigned.length > 0) {
    console.warn(
      `Could not place ${unassigned.length} student(s) under grade rules with current classes (try more classes or fewer students).`,
    );
  }

  if (rows.length === 0) {
    console.error("No valid enrollments to insert.");
    process.exit(1);
  }

  const { data, error: insertError } = await supabase.from("enrollments").insert(rows).select("id");

  if (insertError) {
    console.error(insertError);
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(
        "Hint: row-level security often blocks anon writes; add SUPABASE_SERVICE_ROLE_KEY to .env.local for seeding.",
      );
    }
    process.exit(1);
  }

  console.log(
    `Removed ${deletedCount ?? "?"} prior enrollments; inserted ${data?.length ?? 0} rows (grades 1–10: one grade per class; 11–12 may mix).`,
  );
}

main();
