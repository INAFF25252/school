/**
 * Class enrollment grade policy (mirrors DB trigger `enrollments_enforce_grade_rules`):
 *
 * - **Grades 1–10:** Everyone in the class must be the same grade (no mixing, e.g. no 5th + 6th).
 * - **Grades 11–12:** Juniors and seniors may share a class (11 and 12 may mix).
 *
 * A class may contain only one grade level, or only students in {11, 12} (possibly both).
 */
export function enrollmentGradesCompatible(existingGrades: Iterable<number>, newGrade: number): boolean {
  const grades = new Set([...existingGrades, newGrade]);
  if (grades.size <= 1) return true;
  for (const g of grades) {
    if (g !== 11 && g !== 12) return false;
  }
  return true;
}
