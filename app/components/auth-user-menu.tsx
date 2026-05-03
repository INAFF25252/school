"use client";

import { Avatar } from "@/app/components/avatar";
import { Button } from "@/app/components/button";
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
} from "@/app/components/dropdown";
import {
  authUserAvatarPath,
  AVATAR_ACCEPT,
  explainAccountAvatarMetadataError,
  uploadProfilePhoto,
  validateAvatarFile,
} from "@/lib/profile-avatar-storage";
import { supabase } from "@/supabase";
import clsx from "clsx";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function initialsFromEmail(email: string) {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

function cardChrome(className?: string) {
  return clsx(
    "rounded-lg border border-zinc-950/10 bg-white shadow-xs ring-1 ring-zinc-950/5 dark:border-white/10 dark:bg-zinc-900 dark:ring-white/10",
    className
  );
}

export function AuthUserMenu({
  className,
  variant = "sidebar",
}: {
  className?: string;
  variant?: "sidebar" | "toolbar";
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) {
        setUser(session?.user ?? null);
        setReady(true);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/signup?mode=signin");
    router.refresh();
  }

  async function uploadProfileAvatar(file: File) {
    if (!user) return;
    setAvatarError(null);
    const validation = validateAvatarFile(file);
    if (validation) {
      setAvatarError(validation);
      return;
    }
    setAvatarBusy(true);
    const path = authUserAvatarPath(user.id);
    const uploaded = await uploadProfilePhoto(supabase, path, file);
    if ("error" in uploaded) {
      setAvatarError(uploaded.error);
      setAvatarBusy(false);
      return;
    }
    const bustedUrl = uploaded.publicUrl;
    const { data: authData, error: metaError } = await supabase.auth.updateUser({
      data: { avatar_url: bustedUrl },
    });
    if (metaError) {
      setAvatarError(explainAccountAvatarMetadataError(metaError.message));
      setAvatarBusy(false);
      return;
    }
    if (authData.user) setUser(authData.user);
    setAvatarBusy(false);
  }

  if (!ready) {
    return (
      <div
        className={clsx(
          "flex animate-pulse items-center gap-2 sm:gap-3",
          variant === "toolbar" && "justify-end",
          className
        )}
        aria-hidden
      >
        <div className="h-9 w-full animate-pulse rounded-lg border border-zinc-950/10 bg-zinc-100 shadow-xs ring-1 ring-zinc-950/5 sm:h-10 dark:border-white/10 dark:bg-zinc-800 dark:ring-white/10" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={clsx(variant === "toolbar" && "flex justify-end", className)}>
        <Button
          href="/signup?mode=signin"
          plain
          className={clsx(
            cardChrome(
              "shrink-0 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-50 dark:text-white dark:hover:bg-white/5"
            ),
            variant === "toolbar" && "shrink-0"
          )}
        >
          Sign in
        </Button>
      </div>
    );
  }

  const email = user.email ?? "Signed in";
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const avatarUrl =
    typeof meta?.avatar_url === "string" ? meta.avatar_url : typeof meta?.picture === "string" ? meta.picture : null;
  const initials = initialsFromEmail(email);

  const menuAnchor = variant === "sidebar" ? ("top end" as const) : ("bottom end" as const);

  return (
    <div
      className={clsx(
        "min-w-0",
        variant === "toolbar" && "flex justify-end",
        variant === "sidebar" && "w-full",
        className
      )}
    >
      <Dropdown>
        <div className={clsx(cardChrome("overflow-hidden"), variant === "toolbar" && "max-w-full")}>
          <DropdownButton
            as={Button}
            plain
            className={clsx(
              "flex w-full cursor-default items-center gap-2 px-2 py-1.5 sm:gap-2.5 sm:px-2.5 sm:py-2",
              "text-zinc-950 hover:bg-zinc-50/90 dark:text-white dark:hover:bg-white/5"
            )}
          >
            <Avatar src={avatarUrl} initials={initials} alt="" className="size-7 shrink-0 sm:size-8" aria-hidden />
            <span
              className={clsx(
                "min-w-0 flex-1 truncate text-left text-sm/6 font-medium",
                variant === "toolbar" && "max-w-[min(12rem,38vw)] sm:max-w-[14rem]"
              )}
              title={email}
            >
              {email}
            </span>
            <ChevronDownIcon className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
          </DropdownButton>
        </div>

        <DropdownMenu
          anchor={menuAnchor}
          className={clsx(
            "min-w-[12rem] !bg-white !backdrop-blur-none dark:!bg-zinc-900 dark:!ring-white/10",
            "shadow-lg ring-1 ring-zinc-950/10"
          )}
        >
          <DropdownHeader>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Signed in as</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-zinc-950 dark:text-white">{email}</p>
          </DropdownHeader>
          <DropdownDivider />
          <input
            ref={avatarInputRef}
            type="file"
            accept={AVATAR_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void uploadProfileAvatar(file);
            }}
          />
          <DropdownItem
            disabled={avatarBusy}
            onClick={() => {
              setAvatarError(null);
              avatarInputRef.current?.click();
            }}
          >
            {avatarBusy ? "Uploading photo…" : "Change profile photo"}
          </DropdownItem>
          {avatarError ? (
            <p className="px-3.5 pb-2 text-sm text-red-600 sm:px-3 dark:text-red-400" role="alert">
              {avatarError}
            </p>
          ) : null}
          <DropdownDivider />
          <DropdownItem
            onClick={() => {
              void signOut();
            }}
          >
            Sign out
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}
