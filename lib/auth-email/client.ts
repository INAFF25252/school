import type { Session } from "@supabase/supabase-js";

/**
 * Notify the user by email after auth. Does not throw — failures are logged only.
 * - `new-signup-session`: only welcome (immediate email/password signup with a session).
 * - `signin` | `oauth-complete`: welcome if not yet sent, plus sign-in activity.
 */
export async function notifyAuthEmails(session: Session | null, kind: "new-signup-session" | "signin" | "oauth-complete") {
  if (!session?.access_token) return;

  const headers = {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };

  const welcome = () =>
    fetch("/api/auth/email/welcome", { method: "POST", headers }).catch((e) => {
      console.warn("[auth-email] welcome request failed:", e);
    });

  const signInActivity = () =>
    fetch("/api/auth/email/sign-in", { method: "POST", headers }).catch((e) => {
      console.warn("[auth-email] sign-in activity request failed:", e);
    });

  if (kind === "new-signup-session") {
    await welcome();
    return;
  }

  await Promise.all([welcome(), signInActivity()]);
}
