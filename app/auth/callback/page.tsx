"use client";

import { AuthLayout } from "@/app/components/auth-layout";
import { notifyAuthEmails } from "@/lib/auth-email/client";
import { supabase } from "@/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function normalizeNext(next: string | null) {
  if (!next || !next.startsWith("/")) return "/";
  return next;
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing sign in…");

  useEffect(() => {
    const next = normalizeNext(searchParams.get("next"));
    let cancelled = false;
    let timeout: number | undefined;
    let subscription: { unsubscribe: () => void } | null = null;

    void (async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionError) {
        router.replace(`/auth/auth-code-error?reason=${encodeURIComponent(sessionError.message)}`);
        return;
      }
      if (session) {
        void notifyAuthEmails(session, "oauth-complete");
        router.replace(next);
        router.refresh();
        return;
      }

      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (cancelled) return;
        if (event === "SIGNED_IN" && newSession) {
          void notifyAuthEmails(newSession, "oauth-complete");
          router.replace(next);
          router.refresh();
        }
      });
      subscription = sub;

      timeout = window.setTimeout(() => {
        if (cancelled) return;
        setMessage("Sign in did not complete. Redirecting…");
        router.replace("/auth/auth-code-error");
      }, 12_000);
    })();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
      if (timeout) window.clearTimeout(timeout);
    };
  }, [router, searchParams]);

  return (
    <AuthLayout>
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <div
          className="size-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-600 dark:border-t-indigo-400"
          role="status"
          aria-label="Loading"
        />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      </div>
    </AuthLayout>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
            <div
              className="size-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-600 dark:border-t-indigo-400"
              role="status"
              aria-label="Loading"
            />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
          </div>
        </AuthLayout>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
