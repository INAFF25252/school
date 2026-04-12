import { faker } from "@faker-js/faker";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

/**
 * One enrollment per student (each student in a single class).
 * Each class roster has distinct students (one row per student).
 * (student, class) pairs are all unique.
 */
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
      supabase.from("students").select("id"),
      supabase.from("classes").select("id"),
    ]);

  if (studentsError || classesError) {
    console.error(studentsError ?? classesError);
    process.exit(1);
  }

  const studentIds = students?.map((s) => s.id) ?? [];
  const classIds = classes?.map((c) => c.id) ?? [];

  if (studentIds.length === 0 || classIds.length === 0) {
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

  const shuffledStudents = faker.helpers.shuffle(studentIds);
  const shuffledClasses = faker.helpers.shuffle(classIds);

  const rows: Database["public"]["Tables"]["enrollments"]["Insert"][] =
    shuffledStudents.map((student, i) => ({
      student,
      class: shuffledClasses[i % shuffledClasses.length]!,
    }));

  const { data, error: insertError } = await supabase
    .from("enrollments")
    .insert(rows)
    .select("id");

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
    `Removed ${deletedCount ?? "?"} prior enrollments; inserted ${data?.length ?? 0} rows (one unique class per student, unique students per class).`,
  );
}

main();
