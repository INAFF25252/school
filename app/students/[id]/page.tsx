"use client";

import { Avatar } from "@/app/components/avatar";
import { Badge } from "@/app/components/badge";
import { Button } from "@/app/components/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "@/app/components/description-list";
import { Divider } from "@/app/components/divider";
import { Heading, Subheading } from "@/app/components/heading";
import { Text, TextLink } from "@/app/components/text";
import type { Database } from "@/database.types";
import { supabase } from "@/supabase";
import { useParams } from "next/navigation";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";

type Student = Database["public"]["Tables"]["students"]["Row"];

type EnrolledClassRow = { classId: number; teacherName: string | null };

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

export default function StudentDetailPage() {
  const { id } = useParams();
  const idNum = Number(Array.isArray(id) ? id[0] : id);
  const [student, setStudent] = useState<Student | null>(null);
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchSeq = useRef(0);

  useEffect(() => {
    const seq = ++fetchSeq.current;
    async function fetchStudent() {
      setLoading(true);
      setError(null);
      setEnrolledClasses([]);
      try {
        if (!Number.isFinite(idNum)) {
          setStudent(null);
          setError("That link does not point to a valid student.");
          return;
        }
        const { data, error: fetchError } = await supabase.from("students").select("*").eq("id", idNum).single();
        if (fetchSeq.current !== seq) return;
        if (fetchError) {
          setStudent(null);
          setError(fetchError.message);
          return;
        }
        setStudent(data as Student);

        const { data: enrollRows } = await supabase.from("enrollments").select("class").eq("student", idNum);
        if (fetchSeq.current !== seq) return;
        const classIds = [
          ...new Set(
            (enrollRows ?? [])
              .map((e) => e.class)
              .filter((c): c is number => typeof c === "number")
          ),
        ];
        if (classIds.length === 0) {
          setEnrolledClasses([]);
          return;
        }
        const { data: classRows } = await supabase.from("classes").select("id, teacher").in("id", classIds);
        if (fetchSeq.current !== seq) return;
        const teacherIds = [...new Set((classRows ?? []).map((c) => c.teacher))];
        const teacherMap = new Map<number, string>();
        if (teacherIds.length > 0) {
          const { data: teachers } = await supabase.from("teachers").select("id, name").in("id", teacherIds);
          if (fetchSeq.current !== seq) return;
          for (const t of teachers ?? []) {
            teacherMap.set(t.id, t.name);
          }
        }
        const rows: EnrolledClassRow[] = (classRows ?? []).map((c) => ({
          classId: c.id,
          teacherName: teacherMap.get(c.teacher) ?? null,
        }));
        rows.sort((a, b) => {
          const an = a.teacherName ?? "";
          const bn = b.teacherName ?? "";
          if (an !== bn) return an.localeCompare(bn);
          return a.classId - b.classId;
        });
        setEnrolledClasses(rows);
      } finally {
        if (fetchSeq.current === seq) setLoading(false);
      }
    }
    void fetchStudent();
  }, [idNum]);

  return (
    <div className="min-h-svh bg-zinc-100 px-5 py-8 pb-12 dark:bg-zinc-950 sm:px-8 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-2xl">
        <nav className="mb-6 flex flex-wrap items-center gap-3">
          <Button plain href="/students">
            <svg
              data-slot="icon"
              className="stroke-current"
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
            Back to roster
          </Button>
        </nav>

        <article className="overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <div className="border-b border-zinc-950/5 px-6 py-6 dark:border-white/5 sm:px-8 sm:py-8 lg:px-10">
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="flex items-center gap-4">
                  <div className="size-16 shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-7 w-48 max-w-full rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-4 w-32 rounded bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </div>
              </div>
            ) : student ? (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
                <Avatar
                  square
                  src={student.avatar_url}
                  className="size-16 shrink-0 bg-zinc-100 text-lg text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 sm:size-20 sm:text-xl"
                  initials={initialsFromName(student.name)}
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <Heading className="text-balance">{student.name}</Heading>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Badge color={gradeBadgeColor(student.grade)}>Grade {student.grade}</Badge>
                  </div>
                  <Text className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {enrolledClasses.length === 0
                      ? "Not enrolled in any classes yet."
                      : enrolledClasses.length === 1
                        ? "Enrolled in 1 class."
                        : `Enrolled in ${enrolledClasses.length} classes.`}
                  </Text>
                </div>
              </div>
            ) : error ? (
              <div className="space-y-2">
                <Heading level={2}>Unable to load student</Heading>
                <Text className="text-pretty">{error}</Text>
              </div>
            ) : (
              <div className="space-y-2">
                <Heading level={2}>Student not found</Heading>
                <Text>No student matches that link.</Text>
              </div>
            )}
          </div>

          <div className="px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:pb-10">
            {!loading && student ? (
              <>
                <Subheading level={3} className="text-zinc-950 dark:text-white">
                  Record details
                </Subheading>
                <Divider className="my-5" />
                <DescriptionList className="mt-2">
                  <DescriptionTerm>Full name</DescriptionTerm>
                  <DescriptionDetails>{student.name}</DescriptionDetails>
                  <DescriptionTerm>Grade level</DescriptionTerm>
                  <DescriptionDetails>
                    <Badge color={gradeBadgeColor(student.grade)}>Grade {student.grade}</Badge>
                  </DescriptionDetails>
                </DescriptionList>

                <Divider className="my-8" />

                <Subheading level={3} className="text-zinc-950 dark:text-white">
                  Enrolled classes
                </Subheading>
                {enrolledClasses.length === 0 ? (
                  <Text className="mt-3 text-zinc-600 dark:text-zinc-400">
                    This student is not signed up for any classes yet.
                  </Text>
                ) : (
                  <ul className="mt-4 divide-y divide-zinc-950/10 rounded-xl border border-zinc-950/10 dark:divide-white/10 dark:border-white/10">
                    {enrolledClasses.map((row, index) => (
                      <li
                        key={row.classId}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-zinc-950 dark:text-white">Class</span>
                          <Text className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                            {row.teacherName ? `Led by ${row.teacherName}` : "Teacher not listed"}
                          </Text>
                        </div>
                        <TextLink
                          href={`/classes/${row.classId}`}
                          className="shrink-0 text-sm/6"
                          aria-label={
                            enrolledClasses.length > 1
                              ? `View class ${index + 1} of ${enrolledClasses.length}`
                              : "View class"
                          }
                        >
                          View class
                        </TextLink>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}

            {!loading && !student ? (
              <div className="flex flex-wrap gap-3 pt-2">
                <Button href="/students" color="dark/zinc">
                  Return to students
                </Button>
                {error ? (
                  <Button plain onClick={() => window.location.reload()}>
                    Retry
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </div>
  );
}
