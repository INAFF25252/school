"use client";

import { supabase } from "@/supabase";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function isPublicPath(pathname: string) {
  return (
    pathname === "/signup" ||
    pathname.startsWith("/signup/") ||
    pathname === "/auth/callback" ||
    pathname === "/auth/auth-code-error"
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (isPublicPath(pathname)) {
      return;
    }

    setVerified(false);

    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.replace("/signup");
        return;
      }
      setVerified(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isPublicPath(pathname)) return;
      if (!session) {
        router.replace("/signup");
        setVerified(false);
        return;
      }
      setVerified(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  if (!verified) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <div
          className="size-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-600 dark:border-t-indigo-400"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  return <>{children}</>;
}
