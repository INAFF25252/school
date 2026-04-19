"use client";

import { AuthLayout } from "@/app/components/auth-layout";
import { Button } from "@/app/components/button";
import { Heading } from "@/app/components/heading";
import { Text } from "@/app/components/text";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthCodeErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  return (
    <AuthLayout>
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <Heading level={1} className="text-balance">
            Sign-in could not be completed
          </Heading>
          <Text className="mt-2">
            Something went wrong while finishing Google sign-in. Try again, or use email and password
            instead.
          </Text>
        </div>
        {reason ? (
          <p className="rounded-lg border border-zinc-950/10 bg-zinc-50 p-3 text-left text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300">
            {reason}
          </p>
        ) : null}
        <Button color="indigo" className="w-full" href="/signup">
          Back to sign in
        </Button>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/" className="font-semibold text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400">
            Go home
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <div className="flex w-full max-w-sm justify-center">
            <div
              className="size-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-600 dark:border-t-indigo-400"
              role="status"
              aria-label="Loading"
            />
          </div>
        </AuthLayout>
      }
    >
      <AuthCodeErrorContent />
    </Suspense>
  );
}
