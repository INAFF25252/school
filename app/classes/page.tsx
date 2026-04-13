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
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "@/app/components/dialog";
import { ErrorMessage, Field, FieldGroup, Fieldset, Label, Legend } from "@/app/components/fieldset";
import { Subheading } from "@/app/components/heading";
import { ClassesIcon, HomeIcon, StudentsIcon, TeachersIcon } from "@/app/components/main-nav-icons";
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
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type Teacher = Database["public"]["Tables"]["teachers"]["Row"];

type ClassDeleteImpact = { kind: "ready"; enrollmentCount: number } | { kind: "error"; message: string };

const PAGE_SIZE = 8;

type ClassFormOpen = null | { mode: "create" } | { mode: "edit"; klass: ClassRow };

type FormValues = { teacherId: string };
type FieldErrors = { teacherId?: string };

function validateClassForm(values: FormValues, teacherOptions: Teacher[]): FieldErrors {
  const errors: FieldErrors = {};
  const id = Number(values.teacherId);
  if (!Number.isInteger(id) || id <= 0) {
    errors.teacherId = "Choose a teacher.";
  } else if (!teacherOptions.some((t) => t.id === id)) {
    errors.teacherId = "That teacher is not available.";
  }
  return errors;
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

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

export default function ClassesPage() {
  const pathname = usePathname();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teacherById, setTeacherById] = useState<Record<number, Teacher>>({});
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const firstListLoadDone = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [classForm, setClassForm] = useState<ClassFormOpen>(null);
  const [formValues, setFormValues] = useState<FormValues>({ teacherId: "" });
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formApiError, setFormApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<ClassDeleteImpact | null>(null);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("teachers").select("*").order("name");
      if (cancelled) return;
      setAllTeachers((data ?? []) as Teacher[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadClasses = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      const showFullPageSpinner = !silent && !firstListLoadDone.current;

      if (showFullPageSpinner) setLoading(true);
      setIsFetching(true);
      if (!silent) setError(null);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let qb = supabase.from("classes").select("*", { count: "exact" }).order("id");
      if (teacherFilter !== "all") {
        const tid = Number(teacherFilter);
        if (Number.isInteger(tid) && tid > 0) qb = qb.eq("teacher", tid);
      }

      const { data, error: fetchError, count } = await qb.range(from, to);

      if (fetchError) {
        if (!silent) {
          setError(fetchError.message);
          setErrorDialogOpen(true);
          setClasses([]);
          setTeacherById({});
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

      const classRows = (data ?? []) as ClassRow[];
      const teacherIds = [...new Set(classRows.map((c) => c.teacher))];
      let lookup: Record<number, Teacher> = {};
      if (teacherIds.length > 0) {
        const { data: trows, error: tErr } = await supabase.from("teachers").select("*").in("id", teacherIds);
        if (tErr) {
          if (!silent) {
            setError(tErr.message);
            setErrorDialogOpen(true);
          }
          setClasses([]);
          setTeacherById({});
          setTotalCount(0);
          firstListLoadDone.current = true;
          setIsFetching(false);
          if (showFullPageSpinner) setLoading(false);
          return;
        }
        for (const row of (trows ?? []) as Teacher[]) {
          lookup[row.id] = row;
        }
      }

      setTeacherById(lookup);
      setClasses(classRows);
      firstListLoadDone.current = true;
      setIsFetching(false);
      if (showFullPageSpinner) setLoading(false);
    },
    [page, teacherFilter]
  );

  useLayoutEffect(() => {
    setPage(1);
  }, [teacherFilter]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const openCreateClass = useCallback(() => {
    const first = allTeachers[0];
    setFormValues({ teacherId: first ? String(first.id) : "" });
    setFormErrors({});
    setFormApiError(null);
    setClassForm({ mode: "create" });
  }, [allTeachers]);

  const openEditClass = useCallback((klass: ClassRow) => {
    setFormValues({ teacherId: String(klass.teacher) });
    setFormErrors({});
    setFormApiError(null);
    setClassForm({ mode: "edit", klass });
  }, []);

  const closeClassForm = useCallback(() => {
    if (!saving) setClassForm(null);
  }, [saving]);

  const handleClassFormSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!classForm) return;
      const errs = validateClassForm(formValues, allTeachers);
      if (Object.keys(errs).length > 0) {
        setFormErrors(errs);
        return;
      }
      setFormErrors({});
      setFormApiError(null);
      const teacherId = Number(formValues.teacherId);
      setSaving(true);
      try {
        if (classForm.mode === "create") {
          const { error: insertError } = await supabase.from("classes").insert({ teacher: teacherId }).select("id").single();
          if (insertError) {
            setFormApiError(insertError.message);
            return;
          }
        } else {
          const { error: updateError } = await supabase
            .from("classes")
            .update({ teacher: teacherId })
            .eq("id", classForm.klass.id);
          if (updateError) {
            setFormApiError(updateError.message);
            return;
          }
        }
        setClassForm(null);
        await loadClasses({ silent: true });
      } finally {
        setSaving(false);
      }
    },
    [classForm, formValues, allTeachers, loadClasses]
  );

  const openDeleteClass = useCallback((klass: ClassRow) => {
    setDeleteError(null);
    setDeleteImpact(null);
    setDeleteTarget(klass);
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
    const classId = deleteTarget.id;
    setDeleteImpact(null);
    setDeleteImpactLoading(true);
    void (async () => {
      const { count, error: eErr } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("class", classId);
      if (cancelled) return;
      if (eErr) {
        setDeleteImpact({ kind: "error", message: eErr.message });
        setDeleteImpactLoading(false);
        return;
      }
      setDeleteImpact({ kind: "ready", enrollmentCount: count ?? 0 });
      setDeleteImpactLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [deleteTarget]);

  const confirmDeleteClass = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const { error: enrollErr } = await supabase.from("enrollments").delete().eq("class", deleteTarget.id);
      if (enrollErr) {
        setDeleteError(enrollErr.message);
        return;
      }
      const { error: classErr } = await supabase.from("classes").delete().eq("id", deleteTarget.id);
      if (classErr) {
        setDeleteError(classErr.message);
        return;
      }
      setDeleteTarget(null);
      setDeleteImpact(null);
      await loadClasses({ silent: true });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, loadClasses]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const displayedPage = Math.min(page, pageCount);
  const rangeStart = totalCount === 0 ? 0 : (displayedPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : (displayedPage - 1) * PAGE_SIZE + classes.length;
  const pageListItems = useMemo(
    () => buildPageList(displayedPage, pageCount),
    [displayedPage, pageCount]
  );
  const listBusy = isFetching || (loading && classes.length === 0);

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
        <NavbarLabel className="font-semibold text-zinc-950 dark:text-white">Classes</NavbarLabel>
      </NavbarSection>
      <NavbarDivider className="max-lg:hidden" />
      <NavbarSection className="max-lg:hidden">
        <NavbarItem href="/" current={pathname === "/"}>
          Overview
        </NavbarItem>
        <NavbarItem href="/classes" current>
          Catalog
        </NavbarItem>
      </NavbarSection>
    </Navbar>
  );

  return (
    <>
      <SidebarLayout navbar={navbar} sidebar={sidebar}>
        <div className="mx-auto w-full max-w-5xl space-y-8 pb-2 [--gutter:--spacing(6)]">
          <section
            aria-labelledby="class-filters-heading"
            className="rounded-2xl border border-zinc-950/10 bg-zinc-50/90 p-6 shadow-xs sm:p-8 dark:border-white/10 dark:bg-zinc-950/40 dark:shadow-none"
          >
            <h2 id="class-filters-heading" className="sr-only">
              Filters
            </h2>
            <Fieldset className="border-0 p-0">
              <Legend className="sr-only">Find classes</Legend>
              <FieldGroup className="!mt-0 !space-y-4">
                <div className="grid gap-4 sm:max-w-md sm:items-end">
                  <Field>
                    <Label>Teacher</Label>
                    <Select
                      name="class-filter-teacher"
                      value={teacherFilter}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => setTeacherFilter(e.target.value)}
                    >
                      <option value="all">All teachers</option>
                      {allTeachers.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </FieldGroup>
            </Fieldset>
          </section>

          <section
            aria-labelledby="class-results-heading"
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
              <Subheading id="class-results-heading" level={2} className="shrink-0 text-zinc-950 dark:text-white">
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
                </Text>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
                <Button color="indigo" onClick={openCreateClass} disabled={isFetching || allTeachers.length === 0}>
                  Add class
                </Button>
                <Button outline onClick={() => void loadClasses()} disabled={isFetching}>
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
              {totalCount === 0 && !loading && !isFetching ? (
                <div className="border-t border-dashed border-zinc-950/15 bg-zinc-50/50 px-6 py-14 text-center dark:border-white/10 dark:bg-zinc-950/30 sm:px-8">
                  <Text className="text-balance">
                    {allTeachers.length === 0
                      ? "Add at least one teacher before you can create a class."
                      : "No classes match these filters."}
                  </Text>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button
                      outline
                      onClick={() => {
                        setTeacherFilter("all");
                      }}
                    >
                      Reset filters
                    </Button>
                    {allTeachers.length > 0 ? (
                      <Button color="indigo" onClick={openCreateClass}>
                        Add class
                      </Button>
                    ) : (
                      <Button color="indigo" href="/teachers">
                        Add teacher
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative min-h-[26rem]">
                  {isFetching && classes.length > 0 ? (
                    <div
                      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/90 px-6 backdrop-blur-sm dark:bg-zinc-900/90"
                      aria-busy="true"
                      aria-label="Loading results"
                    >
                      <Spinner />
                      <div className="text-center">
                        <p className="text-sm font-semibold text-zinc-950 dark:text-white">Updating results</p>
                        <Text className="mt-1">Please wait while the list reloads.</Text>
                      </div>
                    </div>
                  ) : null}
                  <Table striped className="[--gutter:--spacing(5)] sm:[--gutter:--spacing(6)]">
                    <TableHead>
                      <TableRow>
                        <TableHeader>Class</TableHeader>
                        <TableHeader className="hidden lg:table-cell">Teacher</TableHeader>
                        <TableHeader className="w-0 text-right">Actions</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Array.from({ length: PAGE_SIZE }, (_, slot) => {
                        const klass = classes[slot];
                        const showSkeletons = listBusy && classes.length === 0;
                        const teacher = klass ? teacherById[klass.teacher] : undefined;
                        if (klass) {
                          return (
                            <TableRow key={klass.id}>
                              <TableCell>
                                <div className="flex min-h-[3.25rem] items-center gap-3">
                                  <Avatar
                                    square
                                    className="size-10 shrink-0 bg-indigo-100 text-sm text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-200"
                                    initials={teacher ? initialsFromName(teacher.name) : "CL"}
                                    alt=""
                                  />
                                  <div className="min-w-0">
                                    <span className="block font-medium text-zinc-950 dark:text-white">Class</span>
                                    {teacher ? (
                                      <span className="mt-0.5 block text-sm text-zinc-600 dark:text-zinc-400">
                                        {teacher.name}
                                      </span>
                                    ) : (
                                      <span className="mt-0.5 block text-sm text-zinc-500 dark:text-zinc-400">
                                        Teacher not loaded
                                      </span>
                                    )}
                                    <TextLink href={`/classes/${klass.id}`} className="mt-0.5 inline-block text-sm/6">
                                      View details
                                    </TextLink>
                                    <div className="mt-1 lg:hidden">
                                      {teacher ? (
                                        <TextLink
                                          href={`/teachers/${teacher.id}`}
                                          className="text-sm/6 text-zinc-600 dark:text-zinc-400"
                                        >
                                          {teacher.name}
                                        </TextLink>
                                      ) : (
                                        <Text className="text-sm text-zinc-400 dark:text-zinc-500">
                                          Teacher unavailable
                                        </Text>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                {teacher ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge color="zinc" className="font-normal">
                                      {teacher.name}
                                    </Badge>
                                    <TextLink href={`/teachers/${teacher.id}`} className="text-sm/6">
                                      Open
                                    </TextLink>
                                  </div>
                                ) : (
                                  <Text className="text-sm text-zinc-500 dark:text-zinc-400">Unavailable</Text>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="relative z-10 flex min-h-[3.25rem] flex-wrap items-center justify-end gap-1">
                                  <Button
                                    plain
                                    onClick={() => openEditClass(klass)}
                                    disabled={saving || deleting || deleteImpactLoading || allTeachers.length === 0}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    plain
                                    onClick={() => openDeleteClass(klass)}
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
                                    <div className="h-4 w-32 max-w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                                    <div className="h-3 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <div className="h-6 w-36 max-w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
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
                            <TableCell className="hidden lg:table-cell">
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
                      aria-label="Class list pagination"
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

      <Dialog open={classForm !== null} onClose={closeClassForm} size="md">
        <div className="flex flex-col gap-1">
          <DialogTitle>{classForm?.mode === "edit" ? "Edit class" : "Add class"}</DialogTitle>
          <DialogDescription>
            {classForm?.mode === "edit"
              ? "Assign a different teacher to this class."
              : "Pick who leads this class. You need at least one teacher in the directory."}
          </DialogDescription>
        </div>
        <form onSubmit={handleClassFormSubmit}>
          <DialogBody>
            {allTeachers.length === 0 ? (
              <Text className="mb-4">
                No teachers yet.{" "}
                <TextLink href="/teachers" className="font-medium">
                  Add a teacher
                </TextLink>{" "}
                first.
              </Text>
            ) : null}
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
                  <Label>Teacher</Label>
                  <Select
                    name="teacherId"
                    value={formValues.teacherId}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setFormValues((v) => ({ ...v, teacherId: e.target.value }))
                    }
                    disabled={saving || allTeachers.length === 0}
                  >
                    <option value="">Select a teacher…</option>
                    {allTeachers.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                  {formErrors.teacherId ? <ErrorMessage>{formErrors.teacherId}</ErrorMessage> : null}
                </Field>
              </FieldGroup>
            </Fieldset>
          </DialogBody>
          <DialogActions>
            <Button type="button" plain onClick={closeClassForm} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" color="dark/zinc" disabled={saving || allTeachers.length === 0}>
              {saving ? "Saving…" : classForm?.mode === "edit" ? "Save changes" : "Create class"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={closeDeleteDialog} size="md">
        <DialogTitle>Remove this class?</DialogTitle>
        <DialogDescription>
          This removes this class
          {deleteTarget ? (
            <>
              {" "}
              (led by{" "}
              <Strong className="text-zinc-950 dark:text-white">
                {teacherById[deleteTarget.teacher]?.name ?? "the assigned teacher"}
              </Strong>
              )
            </>
          ) : null}{" "}
          from the catalog. Student sign-ups for this class are cleared first. You can&apos;t undo it from this screen.
        </DialogDescription>
        <DialogBody className="space-y-4">
          {deleteImpactLoading ? (
            <Text>Checking sign-ups…</Text>
          ) : deleteImpact?.kind === "error" ? (
            <div
              role="status"
              className="rounded-xl border border-zinc-950/15 bg-zinc-950/5 px-4 py-3 text-sm/6 text-zinc-800 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200"
            >
              We couldn&apos;t load the preview. You can still continue—sign-ups are removed first, then the class.
            </div>
          ) : deleteImpact?.kind === "ready" ? (
            <div
              role="region"
              aria-label="What will be removed"
              className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 dark:border-amber-400/30 dark:bg-amber-400/10"
            >
              <p className="text-sm/6 font-semibold text-amber-950 dark:text-amber-100">What happens</p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm/6 text-amber-950/95 dark:text-amber-50/95">
                <li>
                  The class is removed from the catalog
                  {deleteTarget && teacherById[deleteTarget.teacher]?.name ? (
                    <>
                      {" "}
                      (teacher:{" "}
                      <Strong className="text-amber-950 dark:text-amber-50">
                        {teacherById[deleteTarget.teacher]!.name}
                      </Strong>
                      )
                    </>
                  ) : null}
                  .
                </li>
                <li>
                  {deleteImpact.enrollmentCount === 0 ? (
                    <>No student sign-ups reference this class right now.</>
                  ) : (
                    <>
                      <Strong className="text-amber-950 dark:text-amber-50">{deleteImpact.enrollmentCount}</Strong>{" "}
                      {deleteImpact.enrollmentCount === 1
                        ? "student sign-up is removed with it."
                        : "student sign-ups are removed with it."}
                    </>
                  )}
                </li>
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
            onClick={() => void confirmDeleteClass()}
            disabled={deleting || deleteImpactLoading}
          >
            {deleting ? "Removing…" : "Yes, remove it"}
          </Button>
        </DialogActions>
      </Dialog>

      <Alert open={errorDialogOpen} onClose={() => setErrorDialogOpen(false)} size="md">
        <AlertTitle>Could not load classes</AlertTitle>
        <AlertDescription>{error ?? "Something went wrong. Try again in a moment."}</AlertDescription>
        <AlertActions>
          <Button plain onClick={() => setErrorDialogOpen(false)}>
            Dismiss
          </Button>
          <Button
            color="dark/zinc"
            onClick={() => {
              setErrorDialogOpen(false);
              void loadClasses();
            }}
          >
            Retry
          </Button>
        </AlertActions>
      </Alert>
    </>
  );
}
