import { faker } from "@faker-js/faker";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

const COUNT = 100;

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

  const rows: Database["public"]["Tables"]["students"]["Insert"][] =
    Array.from({ length: COUNT }, () => ({
      name: faker.person.fullName(),
      grade: faker.number.int({ min: 1, max: 12 }),
    }));

  const { data, error } = await supabase
    .from("students")
    .insert(rows)
    .select("id");

  if (error) {
    console.error(error);
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(
        "Hint: row-level security often blocks anon inserts; add SUPABASE_SERVICE_ROLE_KEY to .env.local for seeding.",
      );
    }
    process.exit(1);
  }

  console.log(`Inserted ${data?.length ?? 0} students.`);
}

main();
