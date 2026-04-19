"use client";

import { AuthLayout } from "@/app/components/auth-layout";
import { Button } from "@/app/components/button";
import { Description, ErrorMessage, Field, FieldGroup, Fieldset, Label } from "@/app/components/fieldset";
import { Heading } from "@/app/components/heading";
import { Input } from "@/app/components/input";
import { Text } from "@/app/components/text";
import { notifyAuthEmails } from "@/lib/auth-email/client";
import { supabase } from "@/supabase";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Mode = "signup" | "signin";

export default function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) router.replace("/");
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace("/");
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address.");
      return;
    }
    if (!password) {
      setError("Enter a password.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmed,
          password,
          options: origin ? { emailRedirectTo: `${origin}/` } : undefined,
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (data.session) {
          void notifyAuthEmails(data.session, "new-signup-session");
          router.push("/");
          router.refresh();
          return;
        }
        setInfo("Check your email for a confirmation link, then sign in.");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      const {
        data: { session: signInSession },
      } = await supabase.auth.getSession();
      void notifyAuthEmails(signInSession, "signin");
      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setInfo(null);
    setOauthSubmitting(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      if (!origin) {
        setError("Unable to start Google sign-in.");
        return;
      }
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/")}`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
      }
    } finally {
      setOauthSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm space-y-8">
        <div>
          <Heading level={1} className="text-balance">
            {mode === "signup" ? "Create an account" : "Sign in"}
          </Heading>
          <Text className="mt-2">
            {mode === "signup"
              ? "Use your email and a password. Already have an account? Switch to sign in."
              : "Sign in with the email and password for your account."}
          </Text>
        </div>

        <div
          className="flex rounded-lg border border-zinc-950/10 p-0.5 dark:border-white/10"
          role="tablist"
          aria-label="Account mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={clsx(
              "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition",
              mode === "signup"
                ? "bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-white dark:ring-white/10"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            )}
            onClick={() => {
              setMode("signup");
              setError(null);
              setInfo(null);
            }}
          >
            Sign up
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={clsx(
              "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition",
              mode === "signin"
                ? "bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-white dark:ring-white/10"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            )}
            onClick={() => {
              setMode("signin");
              setError(null);
              setInfo(null);
            }}
          >
            Sign in
          </button>
        </div>

        <div className="space-y-4">
          <Button
            type="button"
            outline
            className="w-full"
            disabled={submitting || oauthSubmitting}
            onClick={() => void handleGoogleSignIn()}
          >
            <svg
              data-slot="icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {oauthSubmitting ? "Redirecting…" : "Continue with Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-zinc-950/10 dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs font-semibold uppercase tracking-wide">
              <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                Or continue with email
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Fieldset>
            <FieldGroup>
              <Field>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <Label htmlFor="signup-password">Password</Label>
                <Description>Use at least 6 characters.</Description>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </Field>
              {mode === "signup" ? (
                <Field>
                  <Label htmlFor="signup-confirm">Confirm password</Label>
                  <Input
                    id="signup-confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </Field>
              ) : null}
            </FieldGroup>
          </Fieldset>

          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
          {info ? (
            <p className="text-sm/6 text-emerald-700 dark:text-emerald-400" role="status">
              {info}
            </p>
          ) : null}

          <Button type="submit" color="indigo" className="w-full" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in with email"}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
