import { faker } from "@faker-js/faker";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

const TEACHER_COUNT = 5;
const CLASS_COUNT = 5;

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

  const teacherRows: Database["public"]["Tables"]["teachers"]["Insert"][] =
    Array.from({ length: TEACHER_COUNT }, () => ({
      name: faker.person.fullName(),
      email: faker.internet.email(),
    }));

  const { data: teachers, error: teachersError } = await supabase
    .from("teachers")
    .insert(teacherRows)
    .select("id");

  if (teachersError) {
    console.error(teachersError);
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(
        "Hint: row-level security often blocks anon inserts; add SUPABASE_SERVICE_ROLE_KEY to .env.local for seeding.",
      );
    }
    process.exit(1);
  }

  const teacherIds = teachers?.map((t) => t.id) ?? [];
  if (teacherIds.length < CLASS_COUNT) {
    console.error("Expected teacher ids after insert.");
    process.exit(1);
  }

  const classRows: Database["public"]["Tables"]["classes"]["Insert"][] =
    Array.from({ length: CLASS_COUNT }, (_, i) => ({
      teacher: teacherIds[i]!,
    }));

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .insert(classRows)
    .select("id");

  if (classesError) {
    console.error(classesError);
    process.exit(1);
  }

  console.log(
    `Inserted ${teachers?.length ?? 0} teachers and ${classes?.length ?? 0} classes.`,
  );
}

main();
