import { sendWelcomeEmail, isEmailConfigured } from "@/lib/auth-email/resend";
import { createUserScopedSupabase, getUserFromAuthorizationHeader } from "@/lib/supabase-auth-from-request";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await getUserFromAuthorizationHeader(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { user, accessToken } = auth;
  const email = user.email;
  if (!email) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  if (user.user_metadata?.welcome_email_sent === true) {
    return new NextResponse(null, { status: 204 });
  }

  if (!isEmailConfigured()) {
    console.warn("[auth-email] RESEND_API_KEY is not set; skipping welcome email");
    return new NextResponse(null, { status: 204 });
  }

  const displayName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    undefined;

  const result = await sendWelcomeEmail(email, displayName);
  if (!result.ok) {
    console.error("[auth-email] Welcome send failed:", result.reason);
    return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
  }

  const scoped = createUserScopedSupabase(accessToken);
  const { error: updateError } = await scoped.auth.updateUser({
    data: { welcome_email_sent: true },
  });
  if (updateError) {
    console.error("[auth-email] Could not persist welcome_email_sent:", updateError.message);
  }

  return new NextResponse(null, { status: 204 });
}
