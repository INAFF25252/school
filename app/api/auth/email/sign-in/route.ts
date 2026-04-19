import { sendSignInActivityEmail, isEmailConfigured } from "@/lib/auth-email/resend";
import { getClientContextFromRequest } from "@/lib/request-client-context";
import { getUserFromAuthorizationHeader } from "@/lib/supabase-auth-from-request";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await getUserFromAuthorizationHeader(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { user } = auth;
  const email = user.email;
  if (!email) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  if (!isEmailConfigured()) {
    console.warn("[auth-email] RESEND_API_KEY is not set; skipping sign-in activity email");
    return new NextResponse(null, { status: 204 });
  }

  const displayName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    undefined;

  const ctx = getClientContextFromRequest(request);
  const whenIso = new Date().toISOString();

  const result = await sendSignInActivityEmail(email, displayName, { ...ctx, whenIso });
  if (!result.ok) {
    console.error("[auth-email] Sign-in activity send failed:", result.reason);
    return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
  }

  return new NextResponse(null, { status: 204 });
}
