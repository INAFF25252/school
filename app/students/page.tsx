"use client";

import { supabase } from "@/supabase";
import type { Database } from "@/database.types";
import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
} from "@/app/components/alert";
import { Avatar } from "@/app/components/avatar";
import { Badge } from "@/app/components/badge";
import { Button } from "@/app/components/button";
import { Checkbox, CheckboxField } from "@/app/components/checkbox";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "@/app/components/dialog";
import { ErrorMessage, Field, FieldGroup, Fieldset, Label, Legend } from "@/app/components/fieldset";
import { Subheading } from "@/app/components/heading";
import { Input } from "@/app/components/input";
import {
  Navbar,
  NavbarDivider,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
} from "@/app/components/navbar";
import { Pagination, PaginationGap, PaginationList } from "@/app/components/pagination";
import { Select } from "@/app/components/select";
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from "@/app/components/sidebar";
import { SidebarLayout } from "@/app/components/sidebar-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/table";
import { Strong, Text, TextLink } from "@/app/components/text";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { ChangeEvent, ComponentProps, FormEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type Student = Database["public"]["Tables"]["students"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["enrollments"]["Row"];

type DeleteImpact =
  | {
      kind: "ready";
      enrollmentCount: number;
      distinctClassCount: number;
      nullClassEnrollmentCount: number;
    }
  | { kind: "error"; message: string };

const PAGE_SIZE = 8;
const GRADE_MIN = 1;
const GRADE_MAX = 12;
const NAME_MIN = 2;
const NAME_MAX = 120;

type StudentFormOpen = null | { mode: "create" } | { mode: "edit"; student: Student };

type FormValues = { name: string; grade: string };
type FieldErrors = { name?: string; grade?: string };

function validateStudentForm(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (!name) {
    errors.name = "Name is required.";
  } else if (name.length < NAME_MIN) {
    errors.name = `Name must be at least ${NAME_MIN} characters.`;
  } else if (name.length > NAME_MAX) {
    errors.name = `Name must be at most ${NAME_MAX} characters.`;
  }
  const gradeNum = Number(values.grade);
  if (!Number.isInteger(gradeNum) || gradeNum < GRADE_MIN || gradeNum > GRADE_MAX) {
    errors.grade = `Grade must be a whole number from ${GRADE_MIN} to ${GRADE_MAX}.`;
  }
  return errors;
}

function HomeIcon() {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 16 11h-1v6a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3H9v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" />
    </svg>
  );
}

function StudentsIcon() {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7.5 10A3.5 3.5 0 0 0 4 13.5V15a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.5A3.5 3.5 0 0 0 10.5 10h-3Z" />
      <path d="M16.5 10.5c0 .78-.45 1.45-1.1 1.78.26.35.4.78.4 1.22V15a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1.5c0-.44-.14-.87-.4-1.22.65-.33 1.1-1 1.1-1.78 0-1.1-.9-2-2-2h-.05a4 4 0 0 0-1.2.18c.08.3.12.62.12.95v.12c.35.09.68.24.98.45h.15c.83 0 1.5.67 1.5 1.5Z" />
    </svg>
  );
}

function TeachersIcon() {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 3.5V15a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.5A3.5 3.5 0 0 0 12.5 10h-5A3.5 3.5 0 0 0 3 13.5Z" />
    </svg>
  );
}

function ClassesIcon() {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25h10.5c.69 0 1.25.56 1.25 1.25v8.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-8.5ZM5 7.5h10M5 10h6" />
    </svg>
  );
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

function gradeBadgeColor(grade: number): NonNullable<ComponentProps<typeof Badge>["color"]> {
  if (grade <= 5) return "lime";
  if (grade <= 8) return "sky";
  return "indigo";
}

/** Page numbers with ellipsis gaps for compact pagination. */
function buildPageList(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 1) return [1];
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const set = new Set<number>();
  set.add(1);
  set.add(totalPages);
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= totalPages) set.add(p);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("…");
    out.push(n);
  }
  return out;
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx("size-9 shrink-0 animate-spin text-blue-600 dark:text-blue-400", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/** Strip LIKE wildcards so user input cannot broaden the pattern. */
function sanitizeIlikeTerm(raw: string) {
  return raw.trim().replace(/[%_]/g, "");
}

const GRADE_FILTER_OPTIONS = Array.from({ length: GRADE_MAX - GRADE_MIN + 1 }, (_, i) => GRADE_MIN + i);

export default function StudentsPage() {
  const pathname = usePathname();
  const [students, setStudents] = useState<Student[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const firstListLoadDone = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [highSchoolOnly, setHighSchoolOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [studentForm, setStudentForm] = useState<StudentFormOpen>(null);
  const [formValues, setFormValues] = useState<FormValues>({ name: "", grade: "6" });
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formApiError, setFormApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<DeleteImpact | null>(null);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const loadStudents = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      const showFullPageSpinner = !silent && !firstListLoadDone.current;

      if (showFullPageSpinner) setLoading(true);
      setIsFetching(true);
      if (!silent) setError(null);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let qb = supabase.from("students").select("*", { count: "exact" }).order("name");
      const term = sanitizeIlikeTerm(debouncedQuery);
      if (term.length > 0) {
        qb = qb.ilike("name", `%${term}%`);
      }
      if (gradeFilter !== "all") {
        const g = Number(gradeFilter);
        if (Number.isFinite(g)) qb = qb.eq("grade", g);
      } else if (highSchoolOnly) {
        qb = qb.gte("grade", 9).lte("grade", 12);
      }

      const { data, error: fetchError, count } = await qb.range(from, to);

      if (fetchError) {
        if (!silent) {
          setError(fetchError.message);
          setErrorDialogOpen(true);
          setStudents([]);
          setTotalCount(0);
        }
        firstListLoadDone.current = true;
        setIsFetching(false);
        if (showFullPageSpinner) setLoading(false);
        return;
      }

      const total = count ?? 0;
      setTotalCount(total);
      setErrorDialogOpen(false);

      const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (page > pageCount) {
        setPage(pageCount);
        setIsFetching(false);
        if (showFullPageSpinner) setLoading(false);
        firstListLoadDone.current = true;
        return;
      }

      setStudents((data ?? []) as Student[]);
      firstListLoadDone.current = true;
      setIsFetching(false);
      if (showFullPageSpinner) setLoading(false);
    },
    [page, debouncedQuery, gradeFilter, highSchoolOnly]
  );

  useLayoutEffect(() => {
    setPage(1);
  }, [debouncedQuery, gradeFilter, highSchoolOnly]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const openCreateStudent = useCallback(() => {
    setFormValues({ name: "", grade: "6" });
    setFormErrors({});
    setFormApiError(null);
    setStudentForm({ mode: "create" });
  }, []);

  const openEditStudent = useCallback((student: Student) => {
    setFormValues({ name: student.name, grade: String(student.grade) });
    setFormErrors({});
    setFormApiError(null);
    setStudentForm({ mode: "edit", student });
  }, []);

  const closeStudentForm = useCallback(() => {
    if (!saving) setStudentForm(null);
  }, [saving]);

  const handleStudentFormSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!studentForm) return;
      const errs = validateStudentForm(formValues);
      if (Object.keys(errs).length > 0) {
        setFormErrors(errs);
        return;
      }
      setFormErrors({});
      setFormApiError(null);
      const name = formValues.name.trim();
      const grade = Number(formValues.grade);
      setSaving(true);
      try {
        if (studentForm.mode === "create") {
          const { error: insertError } = await supabase.from("students").insert({ name, grade }).select("id").single();
          if (insertError) {
            setFormApiError(insertError.message);
            return;
          }
        } else {
          const { error: updateError } = await supabase
            .from("students")
            .update({ name, grade })
            .eq("id", studentForm.student.id);
          if (updateError) {
            setFormApiError(updateError.message);
            return;
          }
        }
        setStudentForm(null);
        await loadStudents({ silent: true });
      } finally {
        setSaving(false);
      }
    },
    [studentForm, formValues, loadStudents]
  );

  const openDeleteStudent = useCallback((student: Student) => {
    setDeleteError(null);
    setDeleteImpact(null);
    setDeleteTarget(student);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (!deleting) {
      setDeleteTarget(null);
      setDeleteImpact(null);
      setDeleteImpactLoading(false);
    }
  }, [deleting]);

  useEffect(() => {
    if (!deleteTarget) {
      setDeleteImpact(null);
      setDeleteImpactLoading(false);
      return;
    }
    let cancelled = false;
    const studentId = deleteTarget.id;
    setDeleteImpact(null);
    setDeleteImpactLoading(true);
    void (async () => {
      const { data, error, count } = await supabase
        .from("enrollments")
        .select("class", { count: "exact" })
        .eq("student", studentId);
      if (cancelled) return;
      if (error) {
        setDeleteImpact({ kind: "error", message: error.message });
        setDeleteImpactLoading(false);
        return;
      }
      const rows = (data ?? []) as Pick<EnrollmentRow, "class">[];
      const enrollmentCount = count ?? rows.length;
      const nullClassEnrollmentCount = rows.filter((r) => r.class == null).length;
      const distinctClassCount = new Set(
        rows.map((r) => r.class).filter((c): c is number => typeof c === "number")
      ).size;
      setDeleteImpact({
        kind: "ready",
        enrollmentCount,
        distinctClassCount,
        nullClassEnrollmentCount,
      });
      setDeleteImpactLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [deleteTarget]);

  const confirmDeleteStudent = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const { error: enrollmentsError } = await supabase.from("enrollments").delete().eq("student", deleteTarget.id);
      if (enrollmentsError) {
        setDeleteError(enrollmentsError.message);
        return;
      }
      const { error: studentError } = await supabase.from("students").delete().eq("id", deleteTarget.id);
      if (studentError) {
        setDeleteError(studentError.message);
        return;
      }
      setDeleteTarget(null);
      setDeleteImpact(null);
      await loadStudents({ silent: true });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, loadStudents]);

  const searchPending = query.trim() !== debouncedQuery;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const displayedPage = Math.min(page, pageCount);
  const rangeStart = totalCount === 0 ? 0 : (displayedPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : (displayedPage - 1) * PAGE_SIZE + students.length;
  const pageListItems = useMemo(
    () => buildPageList(displayedPage, pageCount),
    [displayedPage, pageCount]
  );
  const listBusy = isFetching || (loading && students.length === 0);

  const sidebar = (
    <Sidebar className="bg-white lg:rounded-lg lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5 dark:bg-zinc-900 dark:lg:ring-white/10">
      <SidebarHeader>
        <SidebarSection>
          <SidebarHeading>School</SidebarHeading>
          <SidebarItem href="/" current={pathname === "/"}>
            <HomeIcon />
            <SidebarLabel>Home</SidebarLabel>
          </SidebarItem>
        </SidebarSection>
      </SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          <SidebarHeading>Directory</SidebarHeading>
          <SidebarItem href="/students" current={pathname === "/students" || pathname.startsWith("/students/")}>
            <StudentsIcon />
            <SidebarLabel>Students</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/teachers" current={pathname === "/teachers" || pathname.startsWith("/teachers/")}>
            <TeachersIcon />
            <SidebarLabel>Teachers</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/classes" current={pathname === "/classes" || pathname.startsWith("/classes/")}>
            <ClassesIcon />
            <SidebarLabel>Classes</SidebarLabel>
          </SidebarItem>
        </SidebarSection>
      </SidebarBody>
    </Sidebar>
  );

  const navbar = (
    <Navbar>
      <NavbarSection className="min-w-0">
        <NavbarLabel className="font-semibold text-zinc-950 dark:text-white">Students</NavbarLabel>
      </NavbarSection>
      <NavbarDivider className="max-lg:hidden" />
      <NavbarSection className="max-lg:hidden">
        <NavbarItem href="/" current={pathname === "/"}>
          Overview
        </NavbarItem>
        <NavbarItem href="/students" current>
          Roster
        </NavbarItem>
      </NavbarSection>
    </Navbar>
  );

  return (
    <>
      <SidebarLayout navbar={navbar} sidebar={sidebar}>
        <div className="mx-auto w-full max-w-5xl space-y-8 pb-2 [--gutter:--spacing(6)]">
          <section
            aria-labelledby="student-filters-heading"
            className="rounded-2xl border border-zinc-950/10 bg-zinc-50/90 p-6 shadow-xs sm:p-8 dark:border-white/10 dark:bg-zinc-950/40 dark:shadow-none"
          >
            <h2 id="student-filters-heading" className="sr-only">
              Filters
            </h2>
            <Fieldset className="border-0 p-0">
              <Legend className="sr-only">Find students</Legend>
              <FieldGroup className="!mt-0 !space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 sm:items-end sm:gap-6">
                  <Field>
                    <Label>Name</Label>
                    <Input
                      type="search"
                      name="student-search"
                      placeholder="Search…"
                      value={query}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                  <Field>
                    <Label>Grade</Label>
                    <Select
                      name="grade-filter"
                      value={gradeFilter}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => setGradeFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      {GRADE_FILTER_OPTIONS.map((g) => (
                        <option key={g} value={String(g)}>
                          {g}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <CheckboxField>
                  <Checkbox
                    color="indigo"
                    checked={highSchoolOnly}
                    onChange={(checked) => setHighSchoolOnly(checked)}
                    disabled={gradeFilter !== "all"}
                  />
                  <Label>Only grades 9–12</Label>
                </CheckboxField>
              </FieldGroup>
            </Fieldset>
          </section>

          <section
            aria-labelledby="student-results-heading"
            aria-busy={listBusy || undefined}
            className={clsx(
              "overflow-hidden rounded-2xl border bg-white shadow-xs transition-shadow duration-200 dark:bg-zinc-900/60 dark:shadow-none",
              isFetching
                ? "border-blue-500/35 ring-2 ring-blue-500/25 dark:border-blue-400/30 dark:ring-blue-400/20"
                : "border-zinc-950/10 dark:border-white/10"
            )}
          >
            <div
              className="flex min-h-[3.25rem] flex-col gap-3 border-b border-zinc-950/10 px-6 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-8 dark:border-white/10"
              role="status"
              aria-live="polite"
            >
              <Subheading id="student-results-heading" level={2} className="shrink-0 text-zinc-950 dark:text-white">
                Results
              </Subheading>
              <div className="min-h-[1.5rem] min-w-0 flex-1 text-center">
                <Text className="text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Showing </span>
                  <Strong>
                    {rangeStart}–{rangeEnd}
                  </Strong>
                  <span className="text-zinc-500 dark:text-zinc-400"> of </span>
                  <Strong>{totalCount}</Strong>
                  <span className="text-zinc-500 dark:text-zinc-400"> matches</span>
                  {searchPending ? (
                    <span className="mt-1 block text-xs font-normal text-amber-600 dark:text-amber-400">
                      Search updating…
                    </span>
                  ) : null}
                </Text>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
                <Button color="indigo" onClick={openCreateStudent} disabled={isFetching}>
                  Add student
                </Button>
                <Button outline onClick={() => void loadStudents()} disabled={isFetching}>
                  Refresh
                </Button>
              </div>
            </div>

            {listBusy ? (
              <div
                className="h-1 w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800"
                role="progressbar"
                aria-label="Loading data"
              >
                <div className="h-full w-1/3 animate-pulse bg-blue-600 dark:bg-blue-500" />
              </div>
            ) : (
              <div className="h-1 w-full bg-transparent" aria-hidden="true" />
            )}

            <div className="px-4 pb-0 pt-0 sm:px-6">
              {totalCount === 0 && !loading && !searchPending && !isFetching ? (
                <div className="border-t border-dashed border-zinc-950/15 bg-zinc-50/50 px-6 py-14 text-center dark:border-white/10 dark:bg-zinc-950/30 sm:px-8">
                  <Text className="text-balance">No students match these filters.</Text>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button
                      outline
                      onClick={() => {
                        setQuery("");
                        setDebouncedQuery("");
                        setGradeFilter("all");
                        setHighSchoolOnly(false);
                      }}
                    >
                      Reset filters
                    </Button>
                    <Button color="indigo" onClick={openCreateStudent}>
                      Add student
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative min-h-[26rem]">
                  {isFetching && students.length > 0 ? (
                    <div
                      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/90 px-6 backdrop-blur-sm dark:bg-zinc-900/90"
                      aria-busy="true"
                      aria-label="Loading results"
                    >
                      <Spinner />
                      <div className="text-center">
                        <p className="text-sm font-semibold text-zinc-950 dark:text-white">Updating results</p>
                        <Text className="mt-1">Please wait while the roster reloads.</Text>
                      </div>
                    </div>
                  ) : null}
                  <Table striped className="[--gutter:--spacing(5)] sm:[--gutter:--spacing(6)]">
                    <TableHead>
                      <TableRow>
                        <TableHeader>Student</TableHeader>
                        <TableHeader className="text-right">Grade</TableHeader>
                        <TableHeader className="w-0 text-right">Actions</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Array.from({ length: PAGE_SIZE }, (_, slot) => {
                        const student = students[slot];
                        const showSkeletons = listBusy && students.length === 0;
                        if (student) {
                          return (
                            <TableRow key={student.id}>
                              <TableCell>
                                <div className="flex min-h-[3.25rem] items-center gap-3">
                                  <Avatar
                                    square
                                    className="size-10 shrink-0 bg-zinc-100 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                    initials={initialsFromName(student.name)}
                                    alt=""
                                  />
                                  <div className="min-w-0">
                                    <span className="block font-medium text-zinc-950 dark:text-white">
                                      {student.name}
                                    </span>
                                    <TextLink href={`/students/${student.id}`} className="mt-0.5 inline-block text-sm/6">
                                      View profile
                                    </TextLink>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge color={gradeBadgeColor(student.grade)}>Grade {student.grade}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="relative z-10 flex min-h-[3.25rem] flex-wrap items-center justify-end gap-1">
                                  <Button
                                    plain
                                    onClick={() => openEditStudent(student)}
                                    disabled={saving || deleting || deleteImpactLoading}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    plain
                                    onClick={() => openDeleteStudent(student)}
                                    disabled={saving || deleting || deleteImpactLoading}
                                    className="text-red-600 data-hover:bg-red-500/10 dark:text-red-400"
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }
                        if (showSkeletons) {
                          return (
                            <TableRow key={`skeleton-${slot}`}>
                              <TableCell>
                                <div className="flex min-h-[3.25rem] items-center gap-3">
                                  <div className="size-10 shrink-0 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
                                  <div className="min-w-0 flex-1 space-y-2">
                                    <div className="h-4 w-40 max-w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                                    <div className="h-3 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="ml-auto h-6 w-16 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex min-h-[3.25rem] items-center justify-end gap-2">
                                  <div className="h-8 w-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                                  <div className="h-8 w-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return (
                          <TableRow key={`pad-${slot}`} aria-hidden className="pointer-events-none">
                            <TableCell>
                              <div className="min-h-[3.25rem]" />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="min-h-[3.25rem]" />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="min-h-[3.25rem]" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {totalCount > 0 ? (
              <div className="border-t border-zinc-950/10 px-5 py-4 dark:border-white/10 sm:px-8">
                {pageCount > 1 ? (
                  <>
                    <Pagination
                      aria-label="Student list pagination"
                      className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                        <Button
                          plain
                          aria-label="First page"
                          disabled={displayedPage <= 1 || isFetching}
                          onClick={() => setPage(1)}
                        >
                          First
                        </Button>
                        <Button
                          plain
                          aria-label="Previous page"
                          disabled={displayedPage <= 1 || isFetching}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <svg
                            className="stroke-current"
                            data-slot="icon"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M2.75 8H13.25M2.75 8L5.25 5.5M2.75 8L5.25 10.5"
                              strokeWidth={1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Previous
                        </Button>
                      </div>

                      <PaginationList className="!flex flex-wrap items-center justify-center gap-1">
                        {pageListItems.map((item, idx) =>
                          item === "…" ? (
                            <PaginationGap key={`gap-${idx}`} />
                          ) : (
                            <Button
                              key={item}
                              plain
                              aria-label={`Page ${item}`}
                              aria-current={item === displayedPage ? "page" : undefined}
                              disabled={isFetching}
                              onClick={() => {
                                if (item !== displayedPage) setPage(item);
                              }}
                              className={clsx(
                                "min-w-9 before:absolute before:-inset-px before:rounded-lg",
                                item === displayedPage && "before:bg-zinc-950/5 dark:before:bg-white/10"
                              )}
                            >
                              <span className="-mx-0.5">{item}</span>
                            </Button>
                          )
                        )}
                      </PaginationList>

                      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                        <Button
                          plain
                          aria-label="Next page"
                          disabled={displayedPage >= pageCount || isFetching}
                          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        >
                          Next
                          <svg
                            className="stroke-current"
                            data-slot="icon"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M13.25 8L2.75 8M13.25 8L10.75 10.5M13.25 8L10.75 5.5"
                              strokeWidth={1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </Button>
                        <Button
                          plain
                          aria-label="Last page"
                          disabled={displayedPage >= pageCount || isFetching}
                          onClick={() => setPage(pageCount)}
                        >
                          Last
                        </Button>
                      </div>
                    </Pagination>
                    <Text className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
                      Page <Strong>{displayedPage}</Strong> of <Strong>{pageCount}</Strong> · {PAGE_SIZE} rows per page
                    </Text>
                  </>
                ) : (
                  <Text className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                    Showing all <Strong>{totalCount}</Strong> match{totalCount === 1 ? "" : "es"}.
                  </Text>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </SidebarLayout>

      <Dialog open={studentForm !== null} onClose={closeStudentForm} size="md">
        <div className="flex flex-col gap-1">
          <DialogTitle>{studentForm?.mode === "edit" ? "Edit student" : "Add student"}</DialogTitle>
          <DialogDescription>
            {studentForm?.mode === "edit" ? "Change their name or grade." : "Name and grade are required."}
          </DialogDescription>
        </div>
        <form onSubmit={handleStudentFormSubmit}>
          <DialogBody>
            {formApiError ? (
              <div
                role="alert"
                className="mb-6 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm/6 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
              >
                {formApiError}
              </div>
            ) : null}
            <Fieldset>
              <FieldGroup className="!space-y-5">
                <Field>
                  <Label>Name</Label>
                  <Input
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    minLength={NAME_MIN}
                    maxLength={NAME_MAX}
                    value={formValues.name}
                    invalid={!!formErrors.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormValues((v) => ({ ...v, name: e.target.value }))
                    }
                    disabled={saving}
                  />
                  {formErrors.name ? <ErrorMessage>{formErrors.name}</ErrorMessage> : null}
                </Field>
                <Field>
                  <Label>Grade</Label>
                  <Select
                    name="grade"
                    value={formValues.grade}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setFormValues((v) => ({ ...v, grade: e.target.value }))
                    }
                    disabled={saving}
                  >
                    {Array.from({ length: GRADE_MAX - GRADE_MIN + 1 }, (_, i) => GRADE_MIN + i).map((g) => (
                      <option key={g} value={String(g)}>
                        Grade {g}
                      </option>
                    ))}
                  </Select>
                  {formErrors.grade ? <ErrorMessage>{formErrors.grade}</ErrorMessage> : null}
                </Field>
              </FieldGroup>
            </Fieldset>
          </DialogBody>
          <DialogActions>
            <Button type="button" plain onClick={closeStudentForm} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" color="dark/zinc" disabled={saving}>
              {saving ? "Saving…" : studentForm?.mode === "edit" ? "Save changes" : "Create student"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={closeDeleteDialog} size="md">
        <DialogTitle>Remove this student?</DialogTitle>
        <DialogDescription>
          This takes <Strong className="text-zinc-950 dark:text-white">{deleteTarget?.name ?? "this student"}</Strong> off
          your list and removes their class sign-ups. You can&apos;t undo it from this screen.
        </DialogDescription>
        <DialogBody className="space-y-4">
          {deleteImpactLoading ? (
            <Text>Checking class sign-ups…</Text>
          ) : deleteImpact?.kind === "error" ? (
            <div
              role="status"
              className="rounded-xl border border-zinc-950/15 bg-zinc-950/5 px-4 py-3 text-sm/6 text-zinc-800 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200"
            >
              We couldn&apos;t load the preview. You can still continue—class sign-ups are removed first, then the
              student.
            </div>
          ) : deleteImpact?.kind === "ready" && deleteTarget ? (
            <div
              role="region"
              aria-label="What will be removed"
              className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 dark:border-amber-400/30 dark:bg-amber-400/10"
            >
              <p className="text-sm/6 font-semibold text-amber-950 dark:text-amber-100">What happens</p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm/6 text-amber-950/95 dark:text-amber-50/95">
                <li>
                  <Strong className="text-amber-950 dark:text-amber-50">{deleteTarget.name}</Strong> disappears from the
                  roster.
                </li>
                <li>
                  {deleteImpact.enrollmentCount === 0 ? (
                    <>They aren&apos;t signed up for any classes right now.</>
                  ) : (
                    <>
                      <Strong className="text-amber-950 dark:text-amber-50">{deleteImpact.enrollmentCount}</Strong>{" "}
                      {deleteImpact.enrollmentCount === 1
                        ? "class sign-up is removed too."
                        : "class sign-ups are removed too."}
                    </>
                  )}
                </li>
                {deleteImpact.enrollmentCount > 0 && deleteImpact.distinctClassCount > 0 ? (
                  <li>
                    {deleteImpact.distinctClassCount === 1 ? (
                      <>That includes one class.</>
                    ) : (
                      <>
                        That spans{" "}
                        <Strong className="text-amber-950 dark:text-amber-50">{deleteImpact.distinctClassCount}</Strong>{" "}
                        classes.
                      </>
                    )}
                  </li>
                ) : null}
                {deleteImpact.enrollmentCount > 0 && deleteImpact.nullClassEnrollmentCount > 0 ? (
                  <li>
                    <Strong className="text-amber-950 dark:text-amber-50">{deleteImpact.nullClassEnrollmentCount}</Strong>{" "}
                    sign-up
                    {deleteImpact.nullClassEnrollmentCount === 1 ? " isn&apos;t" : "s aren&apos;t"} linked to a class
                    yet.
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {deleteError ? (
            <div
              role="alert"
              className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm/6 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
            >
              {deleteError}
            </div>
          ) : null}
        </DialogBody>
        <DialogActions>
          <Button type="button" plain onClick={closeDeleteDialog} disabled={deleting}>
            Cancel
          </Button>
          <Button
            type="button"
            color="red"
            onClick={() => void confirmDeleteStudent()}
            disabled={deleting || deleteImpactLoading}
          >
            {deleting ? "Removing…" : "Yes, remove them"}
          </Button>
        </DialogActions>
      </Dialog>

      <Alert open={errorDialogOpen} onClose={() => setErrorDialogOpen(false)} size="md">
        <AlertTitle>Could not load students</AlertTitle>
        <AlertDescription>{error ?? "Something went wrong. Try again in a moment."}</AlertDescription>
        <AlertActions>
          <Button plain onClick={() => setErrorDialogOpen(false)}>
            Dismiss
          </Button>
          <Button
            color="dark/zinc"
            onClick={() => {
              setErrorDialogOpen(false);
              void loadStudents();
            }}
          >
            Retry
          </Button>
        </AlertActions>
      </Alert>
    </>
  );
}
