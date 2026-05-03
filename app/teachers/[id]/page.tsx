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
import { useEffect, useRef, useState } from "react";

type Teacher = Database["public"]["Tables"]["teachers"]["Row"];

type ClassTaughtRow = { id: number; studentCount: number };

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export default function TeacherDetailPage() {
  const { id } = useParams();
  const idNum = Number(Array.isArray(id) ? id[0] : id);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [classesTaught, setClassesTaught] = useState<ClassTaughtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchSeq = useRef(0);

  useEffect(() => {
    const seq = ++fetchSeq.current;
    async function fetchTeacher() {
      setLoading(true);
      setError(null);
      setClassesTaught([]);
      try {
        if (!Number.isFinite(idNum)) {
          setTeacher(null);
          setError("That link does not point to a valid teacher.");
          return;
        }
        const { data, error: fetchError } = await supabase.from("teachers").select("*").eq("id", idNum).single();
        if (fetchSeq.current !== seq) return;
        if (fetchError) {
          setTeacher(null);
          setError(fetchError.message);
          return;
        }
        setTeacher(data as Teacher);

        const { data: classRows } = await supabase.from("classes").select("id").eq("teacher", idNum).order("id");
        if (fetchSeq.current !== seq) return;
        const classIds = (classRows ?? []).map((c) => c.id);
        if (classIds.length === 0) {
          setClassesTaught([]);
          return;
        }
        const { data: enrollRows } = await supabase.from("enrollments").select("class").in("class", classIds);
        if (fetchSeq.current !== seq) return;
        const countByClass = new Map<number, number>();
        for (const row of enrollRows ?? []) {
          if (row.class == null) continue;
          countByClass.set(row.class, (countByClass.get(row.class) ?? 0) + 1);
        }
        setClassesTaught(
          classIds.map((id) => ({
            id,
            studentCount: countByClass.get(id) ?? 0,
          }))
        );
      } finally {
        if (fetchSeq.current === seq) setLoading(false);
      }
    }
    void fetchTeacher();
  }, [idNum]);

  return (
    <div className="min-h-svh bg-zinc-100 px-5 py-8 pb-12 dark:bg-zinc-950 sm:px-8 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-2xl">
        <nav className="mb-6 flex flex-wrap items-center gap-3">
          <Button plain href="/teachers">
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
            Back to directory
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
            ) : teacher ? (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
                <Avatar
                  square
                  src={teacher.avatar_url}
                  className="size-16 shrink-0 bg-zinc-100 text-lg text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 sm:size-20 sm:text-xl"
                  initials={initialsFromName(teacher.name)}
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <Heading className="text-balance">{teacher.name}</Heading>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {teacher.email ? (
                      <Badge color="sky" className="max-w-full truncate font-normal">
                        {teacher.email}
                      </Badge>
                    ) : (
                      <Text className="text-sm text-zinc-500 dark:text-zinc-400">No email on file</Text>
                    )}
                  </div>
                  <Text className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {classesTaught.length === 0
                      ? "Not teaching any classes yet."
                      : classesTaught.length === 1
                        ? "Teaching 1 class."
                        : `Teaching ${classesTaught.length} classes.`}
                  </Text>
                </div>
              </div>
            ) : error ? (
              <div className="space-y-2">
                <Heading level={2}>Unable to load teacher</Heading>
                <Text className="text-pretty">{error}</Text>
              </div>
            ) : (
              <div className="space-y-2">
                <Heading level={2}>Teacher not found</Heading>
                <Text>No teacher matches that link.</Text>
              </div>
            )}
          </div>

          <div className="px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:pb-10">
            {!loading && teacher ? (
              <>
                <Subheading level={3} className="text-zinc-950 dark:text-white">
                  Record details
                </Subheading>
                <Divider className="my-5" />
                <DescriptionList className="mt-2">
                  <DescriptionTerm>Full name</DescriptionTerm>
                  <DescriptionDetails>{teacher.name}</DescriptionDetails>
                  <DescriptionTerm>Email</DescriptionTerm>
                  <DescriptionDetails>{teacher.email ?? "—"}</DescriptionDetails>
                </DescriptionList>

                <Divider className="my-8" />

                <Subheading level={3} className="text-zinc-950 dark:text-white">
                  Classes teaching
                </Subheading>
                {classesTaught.length === 0 ? (
                  <Text className="mt-3 text-zinc-600 dark:text-zinc-400">
                    No classes are assigned to this teacher yet.
                  </Text>
                ) : (
                  <ul className="mt-4 divide-y divide-zinc-950/10 rounded-xl border border-zinc-950/10 dark:divide-white/10 dark:border-white/10">
                    {classesTaught.map((c, index) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-zinc-950 dark:text-white">Class</span>
                          <Text className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                            {c.studentCount === 0
                              ? "No students enrolled"
                              : c.studentCount === 1
                                ? "1 student enrolled"
                                : `${c.studentCount} students enrolled`}
                          </Text>
                        </div>
                        <TextLink
                          href={`/classes/${c.id}`}
                          className="shrink-0 text-sm/6"
                          aria-label={
                            classesTaught.length > 1
                              ? `View class ${index + 1} of ${classesTaught.length}`
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

            {!loading && !teacher ? (
              <div className="flex flex-wrap gap-3 pt-2">
                <Button href="/teachers" color="dark/zinc">
                  Return to teachers
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
