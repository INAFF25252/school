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
import { Input } from "@/app/components/input";
import { ClassesIcon, HomeIcon, StudentsIcon, TeachersIcon } from "@/app/components/main-nav-icons";
import {
  Navbar,
  NavbarDivider,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
} from "@/app/components/navbar";
import { Pagination, PaginationGap, PaginationList } from "@/app/components/pagination";
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

type Teacher = Database["public"]["Tables"]["teachers"]["Row"];

type TeacherDeleteImpact =
  | { kind: "ready"; classCount: number; enrollmentCount: number }
  | { kind: "error"; message: string };

const PAGE_SIZE = 8;
const NAME_MIN = 2;
const NAME_MAX = 120;
const EMAIL_MAX = 254;

type TeacherFormOpen = null | { mode: "create" } | { mode: "edit"; teacher: Teacher };

type FormValues = { name: string; email: string };
type FieldErrors = { name?: string; email?: string };

function isValidOptionalEmail(s: string) {
  const t = s.trim();
  if (!t) return true;
  if (t.length > EMAIL_MAX) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function validateTeacherForm(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (!name) {
    errors.name = "Name is required.";
  } else if (name.length < NAME_MIN) {
    errors.name = `Name must be at least ${NAME_MIN} characters.`;
  } else if (name.length > NAME_MAX) {
    errors.name = `Name must be at most ${NAME_MAX} characters.`;
  }
  const email = values.email.trim();
  if (email && !isValidOptionalEmail(values.email)) {
    errors.email = "Enter a valid email or leave this blank.";
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

function sanitizeIlikeTerm(raw: string) {
  return raw.trim().replace(/[%_]/g, "");
}

export default function TeachersPage() {
  const pathname = usePathname();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const firstListLoadDone = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [emailQuery, setEmailQuery] = useState("");
  const [debouncedEmailQuery, setDebouncedEmailQuery] = useState("");
  const [page, setPage] = useState(1);

  const [teacherForm, setTeacherForm] = useState<TeacherFormOpen>(null);
  const [formValues, setFormValues] = useState<FormValues>({ name: "", email: "" });
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formApiError, setFormApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<TeacherDeleteImpact | null>(null);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedEmailQuery(emailQuery.trim()), 300);
    return () => window.clearTimeout(t);
  }, [emailQuery]);

  const loadTeachers = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      const showFullPageSpinner = !silent && !firstListLoadDone.current;

      if (showFullPageSpinner) setLoading(true);
      setIsFetching(true);
      if (!silent) setError(null);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let qb = supabase.from("teachers").select("*", { count: "exact" }).order("name");
      const nameTerm = sanitizeIlikeTerm(debouncedQuery);
      const emailTerm = sanitizeIlikeTerm(debouncedEmailQuery);
      if (nameTerm.length > 0) {
        qb = qb.ilike("name", `%${nameTerm}%`);
      }
      if (emailTerm.length > 0) {
        qb = qb.ilike("email", `%${emailTerm}%`);
      }

      const { data, error: fetchError, count } = await qb.range(from, to);

      if (fetchError) {
        if (!silent) {
          setError(fetchError.message);
          setErrorDialogOpen(true);
          setTeachers([]);
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

      setTeachers((data ?? []) as Teacher[]);
      firstListLoadDone.current = true;
      setIsFetching(false);
      if (showFullPageSpinner) setLoading(false);
    },
    [page, debouncedQuery, debouncedEmailQuery]
  );

  useLayoutEffect(() => {
    setPage(1);
  }, [debouncedQuery, debouncedEmailQuery]);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  const openCreateTeacher = useCallback(() => {
    setFormValues({ name: "", email: "" });
    setFormErrors({});
    setFormApiError(null);
    setTeacherForm({ mode: "create" });
  }, []);

  const openEditTeacher = useCallback((teacher: Teacher) => {
    setFormValues({ name: teacher.name, email: teacher.email ?? "" });
    setFormErrors({});
    setFormApiError(null);
    setTeacherForm({ mode: "edit", teacher });
  }, []);

  const closeTeacherForm = useCallback(() => {
    if (!saving) setTeacherForm(null);
  }, [saving]);

  const handleTeacherFormSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!teacherForm) return;
      const errs = validateTeacherForm(formValues);
      if (Object.keys(errs).length > 0) {
        setFormErrors(errs);
        return;
      }
      setFormErrors({});
      setFormApiError(null);
      const name = formValues.name.trim();
      const emailTrim = formValues.email.trim();
      const email = emailTrim.length > 0 ? emailTrim : null;
      setSaving(true);
      try {
        if (teacherForm.mode === "create") {
          const { error: insertError } = await supabase.from("teachers").insert({ name, email }).select("id").single();
          if (insertError) {
            setFormApiError(insertError.message);
            return;
          }
        } else {
          const { error: updateError } = await supabase
            .from("teachers")
            .update({ name, email })
            .eq("id", teacherForm.teacher.id);
          if (updateError) {
            setFormApiError(updateError.message);
            return;
          }
        }
        setTeacherForm(null);
        await loadTeachers({ silent: true });
      } finally {
        setSaving(false);
      }
    },
    [teacherForm, formValues, loadTeachers]
  );

  const openDeleteTeacher = useCallback((teacher: Teacher) => {
    setDeleteError(null);
    setDeleteImpact(null);
    setDeleteTarget(teacher);
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
    const teacherId = deleteTarget.id;
    setDeleteImpact(null);
    setDeleteImpactLoading(true);
    void (async () => {
      const { data: classes, error: cErr } = await supabase.from("classes").select("id").eq("teacher", teacherId);
      if (cancelled) return;
      if (cErr) {
        setDeleteImpact({ kind: "error", message: cErr.message });
        setDeleteImpactLoading(false);
        return;
      }
      const classIds = (classes ?? []).map((c) => c.id);
      if (classIds.length === 0) {
        setDeleteImpact({ kind: "ready", classCount: 0, enrollmentCount: 0 });
        setDeleteImpactLoading(false);
        return;
      }
      const { count, error: eErr } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .in("class", classIds);
      if (cancelled) return;
      if (eErr) {
        setDeleteImpact({ kind: "error", message: eErr.message });
        setDeleteImpactLoading(false);
        return;
      }
      setDeleteImpact({
        kind: "ready",
        classCount: classIds.length,
        enrollmentCount: count ?? 0,
      });
      setDeleteImpactLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [deleteTarget]);

  const confirmDeleteTeacher = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const { data: classes, error: cFetchErr } = await supabase.from("classes").select("id").eq("teacher", deleteTarget.id);
      if (cFetchErr) {
        setDeleteError(cFetchErr.message);
        return;
      }
      const classIds = (classes ?? []).map((c) => c.id);
      if (classIds.length > 0) {
        const { error: enrollErr } = await supabase.from("enrollments").delete().in("class", classIds);
        if (enrollErr) {
          setDeleteError(enrollErr.message);
          return;
        }
        const { error: classErr } = await supabase.from("classes").delete().eq("teacher", deleteTarget.id);
        if (classErr) {
          setDeleteError(classErr.message);
          return;
        }
      }
      const { error: teacherErr } = await supabase.from("teachers").delete().eq("id", deleteTarget.id);
      if (teacherErr) {
        setDeleteError(teacherErr.message);
        return;
      }
      setDeleteTarget(null);
      setDeleteImpact(null);
      await loadTeachers({ silent: true });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, loadTeachers]);

  const searchPending = query.trim() !== debouncedQuery || emailQuery.trim() !== debouncedEmailQuery;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const displayedPage = Math.min(page, pageCount);
  const rangeStart = totalCount === 0 ? 0 : (displayedPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : (displayedPage - 1) * PAGE_SIZE + teachers.length;
  const pageListItems = useMemo(
    () => buildPageList(displayedPage, pageCount),
    [displayedPage, pageCount]
  );
  const listBusy = isFetching || (loading && teachers.length === 0);

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
        <NavbarLabel className="font-semibold text-zinc-950 dark:text-white">Teachers</NavbarLabel>
      </NavbarSection>
      <NavbarDivider className="max-lg:hidden" />
      <NavbarSection className="max-lg:hidden">
        <NavbarItem href="/" current={pathname === "/"}>
          Overview
        </NavbarItem>
        <NavbarItem href="/teachers" current>
          Directory
        </NavbarItem>
      </NavbarSection>
    </Navbar>
  );

  return (
    <>
      <SidebarLayout navbar={navbar} sidebar={sidebar}>
        <div className="mx-auto w-full max-w-5xl space-y-6 pb-2 [--gutter:--spacing(6)]">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button color="indigo" onClick={openCreateTeacher} disabled={isFetching}>
              Add teacher
            </Button>
          </div>

          <section
            aria-labelledby="teacher-results-heading"
            aria-busy={listBusy || undefined}
            className={clsx(
              "overflow-hidden rounded-2xl border bg-white shadow-xs transition-shadow duration-200 dark:bg-zinc-900/60 dark:shadow-none",
              isFetching
                ? "border-blue-500/35 ring-2 ring-blue-500/25 dark:border-blue-400/30 dark:ring-blue-400/20"
                : "border-zinc-950/10 dark:border-white/10"
            )}
          >
            <div className="border-b border-zinc-950/10 bg-zinc-50/50 px-6 py-5 dark:border-white/10 dark:bg-zinc-950/30 sm:px-8">
              <h2 id="teacher-filters-heading" className="sr-only">
                Filters
              </h2>
              <Fieldset className="border-0 p-0">
                <Legend className="sr-only">Find teachers</Legend>
                <FieldGroup className="!mt-0 !space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 sm:items-end sm:gap-6">
                    <Field>
                      <Label>Name</Label>
                      <Input
                        type="search"
                        name="teacher-search-name"
                        placeholder="Search by name…"
                        value={query}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                        autoComplete="off"
                      />
                    </Field>
                    <Field>
                      <Label>Email</Label>
                      <Input
                        type="search"
                        name="teacher-search-email"
                        placeholder="Filter by email…"
                        value={emailQuery}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailQuery(e.target.value)}
                        autoComplete="off"
                      />
                    </Field>
                  </div>
                </FieldGroup>
              </Fieldset>
            </div>

            <div
              className="flex min-h-[3.25rem] flex-wrap items-center justify-center gap-x-3 gap-y-2 border-b border-zinc-950/10 px-6 py-4 text-center sm:px-8 dark:border-white/10"
              role="status"
              aria-live="polite"
            >
              <Subheading id="teacher-results-heading" level={2} className="text-zinc-950 dark:text-white">
                Teachers
              </Subheading>
              <Text className="text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Showing </span>
                <Strong>
                  {rangeStart}–{rangeEnd}
                </Strong>
                <span className="text-zinc-500 dark:text-zinc-400"> of </span>
                <Strong>{totalCount}</Strong>
                <span className="text-zinc-500 dark:text-zinc-400"> matches</span>
                {searchPending ? (
                  <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">Search updating…</span>
                ) : null}
              </Text>
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

            <div>
              {totalCount === 0 && !loading && !searchPending && !isFetching ? (
                <div className="border-t border-dashed border-zinc-950/15 bg-zinc-50/50 px-6 py-14 text-center dark:border-white/10 dark:bg-zinc-950/30 sm:px-8">
                  <Text className="text-balance">No teachers match these filters.</Text>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button
                      outline
                      onClick={() => {
                        setQuery("");
                        setDebouncedQuery("");
                        setEmailQuery("");
                        setDebouncedEmailQuery("");
                      }}
                    >
                      Reset filters
                    </Button>
                    <Button color="indigo" onClick={openCreateTeacher}>
                      Add teacher
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative min-h-[26rem]">
                  {isFetching && teachers.length > 0 ? (
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
                        <TableHeader>Teacher</TableHeader>
                        <TableHeader className="hidden md:table-cell">Email</TableHeader>
                        <TableHeader className="whitespace-nowrap text-center">Actions</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Array.from({ length: PAGE_SIZE }, (_, slot) => {
                        const teacher = teachers[slot];
                        const showSkeletons = listBusy && teachers.length === 0;
                        if (teacher) {
                          return (
                            <TableRow key={teacher.id}>
                              <TableCell>
                                <div className="flex min-h-[3.25rem] items-center gap-3">
                                  <Avatar
                                    square
                                    className="size-10 shrink-0 bg-zinc-100 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                    initials={initialsFromName(teacher.name)}
                                    alt=""
                                  />
                                  <div className="min-w-0">
                                    <span className="block font-medium text-zinc-950 dark:text-white">
                                      {teacher.name}
                                    </span>
                                    <div className="mt-1 md:hidden">
                                      {teacher.email ? (
                                        <Text className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                                          {teacher.email}
                                        </Text>
                                      ) : (
                                        <Text className="text-sm text-zinc-400 dark:text-zinc-500">No email</Text>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {teacher.email ? (
                                  <Badge color="sky" className="max-w-[14rem] truncate font-normal">
                                    {teacher.email}
                                  </Badge>
                                ) : (
                                  <Text className="text-sm text-zinc-400 dark:text-zinc-500">—</Text>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="relative z-10 flex min-h-[3.25rem] flex-row flex-wrap items-center justify-center gap-6">
                                  <TextLink href={`/teachers/${teacher.id}`} className="shrink-0 text-sm/6">
                                    View profile
                                  </TextLink>
                                  <Button
                                    plain
                                    onClick={() => openEditTeacher(teacher)}
                                    disabled={saving || deleting || deleteImpactLoading}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    plain
                                    onClick={() => openDeleteTeacher(teacher)}
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
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <div className="h-6 w-40 max-w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex min-h-[3.25rem] items-center justify-center gap-6">
                                  <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
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
                            <TableCell className="hidden md:table-cell">
                              <div className="min-h-[3.25rem]" />
                            </TableCell>
                            <TableCell className="text-center">
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
                      aria-label="Teacher list pagination"
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

      <Dialog open={teacherForm !== null} onClose={closeTeacherForm} size="md">
        <div className="flex flex-col gap-1">
          <DialogTitle>{teacherForm?.mode === "edit" ? "Edit teacher" : "Add teacher"}</DialogTitle>
          <DialogDescription>
            {teacherForm?.mode === "edit" ? "Change their name or email." : "Name is required. Email is optional."}
          </DialogDescription>
        </div>
        <form onSubmit={handleTeacherFormSubmit}>
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
                  <Label>Email</Label>
                  <Input
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={EMAIL_MAX}
                    placeholder="name@school.edu"
                    value={formValues.email}
                    invalid={!!formErrors.email}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormValues((v) => ({ ...v, email: e.target.value }))
                    }
                    disabled={saving}
                  />
                  {formErrors.email ? <ErrorMessage>{formErrors.email}</ErrorMessage> : null}
                </Field>
              </FieldGroup>
            </Fieldset>
          </DialogBody>
          <DialogActions>
            <Button type="button" plain onClick={closeTeacherForm} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" color="dark/zinc" disabled={saving}>
              {saving ? "Saving…" : teacherForm?.mode === "edit" ? "Save changes" : "Create teacher"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={closeDeleteDialog} size="md">
        <DialogTitle>Remove this teacher?</DialogTitle>
        <DialogDescription>
          This removes <Strong className="text-zinc-950 dark:text-white">{deleteTarget?.name ?? "this teacher"}</Strong>{" "}
          from the directory. Classes they lead and related sign-ups are cleared first. You can&apos;t undo it from this
          screen.
        </DialogDescription>
        <DialogBody className="space-y-4">
          {deleteImpactLoading ? (
            <Text>Checking classes and sign-ups…</Text>
          ) : deleteImpact?.kind === "error" ? (
            <div
              role="status"
              className="rounded-xl border border-zinc-950/15 bg-zinc-950/5 px-4 py-3 text-sm/6 text-zinc-800 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200"
            >
              We couldn&apos;t load the preview. You can still continue—sign-ups are removed first, then classes, then the
              teacher.
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
                  directory.
                </li>
                <li>
                  {deleteImpact.classCount === 0 ? (
                    <>They aren&apos;t listed for any classes right now.</>
                  ) : (
                    <>
                      <Strong className="text-amber-950 dark:text-amber-50">{deleteImpact.classCount}</Strong>{" "}
                      {deleteImpact.classCount === 1 ? "class they lead is removed." : "classes they lead are removed."}
                    </>
                  )}
                </li>
                {deleteImpact.enrollmentCount > 0 ? (
                  <li>
                    <Strong className="text-amber-950 dark:text-amber-50">{deleteImpact.enrollmentCount}</Strong>{" "}
                    {deleteImpact.enrollmentCount === 1
                      ? "student sign-up tied to those classes is cleared."
                      : "student sign-ups tied to those classes are cleared."}
                  </li>
                ) : deleteImpact.classCount > 0 ? (
                  <li>No student sign-ups are tied to those classes.</li>
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
            onClick={() => void confirmDeleteTeacher()}
            disabled={deleting || deleteImpactLoading}
          >
            {deleting ? "Removing…" : "Yes, remove them"}
          </Button>
        </DialogActions>
      </Dialog>

      <Alert open={errorDialogOpen} onClose={() => setErrorDialogOpen(false)} size="md">
        <AlertTitle>Could not load teachers</AlertTitle>
        <AlertDescription>{error ?? "Something went wrong. Try again in a moment."}</AlertDescription>
        <AlertActions>
          <Button plain onClick={() => setErrorDialogOpen(false)}>
            Dismiss
          </Button>
          <Button
            color="dark/zinc"
            onClick={() => {
              setErrorDialogOpen(false);
              void loadTeachers();
            }}
          >
            Retry
          </Button>
        </AlertActions>
      </Alert>
    </>
  );
}
