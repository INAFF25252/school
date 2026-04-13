/**
 * Rules for who may share a class (mirrors DB trigger `enrollments_enforce_grade_rules`):
 * - Either everyone has the same grade, or
 * - Everyone is in grades 11 or 12 (11 and 12 may mix).
 */
export function enrollmentGradesCompatible(existingGrades: Iterable<number>, newGrade: number): boolean {
  const combined = new Set([...existingGrades, newGrade]);
  if (combined.size <= 1) return true;
  return [...combined].every((g) => g === 11 || g === 12);
}
