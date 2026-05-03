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

type OAuthProviderId = "google" | "discord" | "github";

export default function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<OAuthProviderId | null>(null);
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

  async function handleOAuthSignIn(provider: OAuthProviderId) {
    setError(null);
    setInfo(null);
    setOauthProvider(provider);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      if (!origin) {
        setError("Unable to start sign-in.");
        return;
      }
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/")}`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
      }
    } finally {
      setOauthProvider(null);
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

        <div className="space-y-3">
          <Button
            type="button"
            outline
            className="w-full"
            disabled={submitting || oauthProvider !== null}
            onClick={() => void handleOAuthSignIn("google")}
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
            {oauthProvider === "google" ? "Redirecting…" : "Continue with Google"}
          </Button>

          <Button
            type="button"
            outline
            className="w-full"
            disabled={submitting || oauthProvider !== null}
            onClick={() => void handleOAuthSignIn("discord")}
          >
            <svg data-slot="icon" viewBox="0 0 24 24" aria-hidden="true" fill="#5865F2">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            {oauthProvider === "discord" ? "Redirecting…" : "Continue with Discord"}
          </Button>

          <Button
            type="button"
            outline
            className="w-full"
            disabled={submitting || oauthProvider !== null}
            onClick={() => void handleOAuthSignIn("github")}
          >
            <svg
              data-slot="icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="text-zinc-950 dark:text-white"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.05 10.05 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
              />
            </svg>
            {oauthProvider === "github" ? "Redirecting…" : "Continue with GitHub"}
          </Button>

          <div className="relative pt-1">
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
