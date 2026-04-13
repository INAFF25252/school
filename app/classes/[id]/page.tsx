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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/table";
import { Text, TextLink } from "@/app/components/text";
import type { Database } from "@/database.types";
import { supabase } from "@/supabase";
import { useParams } from "next/navigation";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type Teacher = Database["public"]["Tables"]["teachers"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];

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

export default function ClassDetailPage() {
  const { id } = useParams();
  const idNum = Number(Array.isArray(id) ? id[0] : id);
  const [klass, setKlass] = useState<ClassRow | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [enrollmentCount, setEnrollmentCount] = useState<number | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchSeq = useRef(0);

  useEffect(() => {
    const seq = ++fetchSeq.current;
    async function fetchClass() {
      setLoading(true);
      setError(null);
      setEnrollmentCount(null);
      setEnrolledStudents([]);
      try {
        if (!Number.isFinite(idNum)) {
          setKlass(null);
          setTeacher(null);
          setError("That link does not point to a valid class.");
          return;
        }
        const { data: classData, error: classError } = await supabase.from("classes").select("*").eq("id", idNum).single();
        if (fetchSeq.current !== seq) return;
        if (classError) {
          setKlass(null);
          setTeacher(null);
          setError(classError.message);
          return;
        }
        const row = classData as ClassRow;
        setKlass(row);

        const [{ data: teacherData, error: teacherError }, { count }, { data: enrollRows, error: enrollErr }] =
          await Promise.all([
            supabase.from("teachers").select("*").eq("id", row.teacher).single(),
            supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("class", row.id),
            supabase.from("enrollments").select("student").eq("class", row.id),
          ]);
        if (fetchSeq.current !== seq) return;
        if (teacherError) {
          setTeacher(null);
        } else {
          setTeacher(teacherData as Teacher);
        }
        setEnrollmentCount(count ?? 0);

        if (enrollErr) {
          setEnrolledStudents([]);
        } else {
          const studentIds = [...new Set((enrollRows ?? []).map((e) => e.student))];
          if (studentIds.length === 0) {
            setEnrolledStudents([]);
          } else {
            const { data: studs, error: sErr } = await supabase
              .from("students")
              .select("*")
              .in("id", studentIds)
              .order("name");
            if (fetchSeq.current !== seq) return;
            if (sErr) {
              setEnrolledStudents([]);
            } else {
              setEnrolledStudents((studs ?? []) as Student[]);
            }
          }
        }
      } finally {
        if (fetchSeq.current === seq) setLoading(false);
      }
    }
    void fetchClass();
  }, [idNum]);

  return (
    <div className="min-h-svh bg-zinc-100 px-5 py-8 pb-12 dark:bg-zinc-950 sm:px-8 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-2xl">
        <nav className="mb-6 flex flex-wrap items-center gap-3">
          <Button plain href="/classes">
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
            Back to catalog
          </Button>
        </nav>

        <article className="overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <div className="border-b border-zinc-950/5 px-6 py-6 dark:border-white/5 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="flex items-center gap-4">
                  <div className="size-16 shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-7 w-40 max-w-full rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-4 w-48 rounded bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </div>
              </div>
            ) : klass ? (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
                <Avatar
                  square
                  className="size-16 shrink-0 bg-indigo-100 text-lg text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-100 sm:size-20 sm:text-xl"
                  initials={teacher ? initialsFromName(teacher.name) : "CL"}
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <Heading className="text-balance">Class</Heading>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {!teacher ? (
                      <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                        Teacher details could not be loaded.
                      </Text>
                    ) : null}
                    {enrollmentCount !== null ? (
                      <span className="text-sm/6 text-zinc-500 tabular-nums dark:text-zinc-400">
                        {enrollmentCount} sign-up{enrollmentCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="space-y-2">
                <Heading level={2}>Unable to load class</Heading>
                <Text className="text-pretty">{error}</Text>
              </div>
            ) : (
              <div className="space-y-2">
                <Heading level={2}>Class not found</Heading>
                <Text>No class matches that link.</Text>
              </div>
            )}
          </div>

          <div className="px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:pb-10">
            {!loading && klass ? (
              <>
                <Subheading level={3} className="text-zinc-950 dark:text-white">
                  Record details
                </Subheading>
                <Divider className="my-5" />
                <DescriptionList className="mt-2">
                  <DescriptionTerm>Teacher</DescriptionTerm>
                  <DescriptionDetails>
                    {teacher ? (
                      <TextLink href={`/teachers/${teacher.id}`}>{teacher.name}</TextLink>
                    ) : (
                      "—"
                    )}
                  </DescriptionDetails>
                  <DescriptionTerm>Student sign-ups</DescriptionTerm>
                  <DescriptionDetails>
                    {enrollmentCount === null ? "—" : enrollmentCount}
                  </DescriptionDetails>
                </DescriptionList>

                <Divider className="my-8" />

                <Subheading level={3} className="text-zinc-950 dark:text-white">
                  Students enrolled
                </Subheading>

                {enrolledStudents.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-zinc-950/15 bg-zinc-50/80 px-5 py-10 text-center dark:border-white/10 dark:bg-zinc-950/40 sm:px-8">
                    <Text>No students are enrolled in this class yet.</Text>
                  </div>
                ) : (
                  <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-950/10 p-4 sm:p-5 dark:border-white/10">
                    <Table striped className="[--gutter:--spacing(5)] sm:[--gutter:--spacing(6)] min-w-[20rem]">
                      <TableHead>
                        <TableRow>
                          <TableHeader>Student</TableHeader>
                          <TableHeader className="text-right">Grade</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {enrolledStudents.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell>
                              <div className="flex min-h-[3rem] items-center gap-3">
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
                                  <TextLink
                                    href={`/students/${student.id}`}
                                    className="mt-0.5 inline-block text-sm/6"
                                  >
                                    View profile
                                  </TextLink>
                                </div>
                                </div>
                              </TableCell>
                            <TableCell className="text-right">
                              <Badge color={gradeBadgeColor(student.grade)}>Grade {student.grade}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            ) : null}

            {!loading && !klass ? (
              <div className="flex flex-wrap gap-3 pt-2">
                <Button href="/classes" color="dark/zinc">
                  Return to classes
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
