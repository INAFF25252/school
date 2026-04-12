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
import { Text } from "@/app/components/text";
import type { Database } from "@/database.types";
import { supabase } from "@/supabase";
import { useParams } from "next/navigation";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";

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

export default function StudentDetailPage() {
  const { id } = useParams();
  const idNum = Number(Array.isArray(id) ? id[0] : id);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchStudent() {
      setLoading(true);
      setError(null);
      if (!Number.isFinite(idNum)) {
        setStudent(null);
        setError("Invalid student id.");
        setLoading(false);
        return;
      }
      const { data, error: fetchError } = await supabase.from("students").select("*").eq("id", idNum).single();
      if (cancelled) return;
      if (fetchError) {
        setStudent(null);
        setError(fetchError.message);
      } else {
        setStudent(data as Student);
      }
      setLoading(false);
    }
    void fetchStudent();
    return () => {
      cancelled = true;
    };
  }, [idNum]);

  return (
    <div className="min-h-svh bg-zinc-100 px-4 py-8 pb-12 dark:bg-zinc-950 sm:px-6 sm:py-10 lg:px-8">
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
          <div className="border-b border-zinc-950/5 px-6 py-6 dark:border-white/5 sm:px-10 sm:py-8">
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
                  className="size-16 shrink-0 bg-zinc-100 text-lg text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 sm:size-20 sm:text-xl"
                  initials={initialsFromName(student.name)}
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <Heading className="text-balance">{student.name}</Heading>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Badge color={gradeBadgeColor(student.grade)}>Grade {student.grade}</Badge>
                    <span className="text-sm/6 text-zinc-500 tabular-nums dark:text-zinc-400">#{student.id}</span>
                  </div>
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
                <Text>No record exists for this id.</Text>
              </div>
            )}
          </div>

          <div className="px-6 py-6 sm:px-10 sm:py-8">
            {!loading && student ? (
              <>
                <Subheading level={3} className="text-zinc-950 dark:text-white">
                  Record details
                </Subheading>
                <Divider className="my-5" />
                <DescriptionList className="mt-2">
                  <DescriptionTerm>Student ID</DescriptionTerm>
                  <DescriptionDetails className="font-mono text-sm tabular-nums">{student.id}</DescriptionDetails>
                  <DescriptionTerm>Full name</DescriptionTerm>
                  <DescriptionDetails>{student.name}</DescriptionDetails>
                  <DescriptionTerm>Grade level</DescriptionTerm>
                  <DescriptionDetails>
                    <Badge color={gradeBadgeColor(student.grade)}>Grade {student.grade}</Badge>
                  </DescriptionDetails>
                </DescriptionList>
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
