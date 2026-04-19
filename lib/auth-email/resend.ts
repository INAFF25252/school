import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getAuthEmailFromAddress() {
  return process.env.AUTH_EMAIL_FROM ?? "School directory <onboarding@resend.dev>";
}

export async function sendWelcomeEmail(to: string, displayName: string | undefined) {
  const resend = getResend();
  if (!resend) return { ok: false as const, reason: "missing_resend" };

  const name = displayName?.trim() || "there";
  const { error } = await resend.emails.send({
    from: getAuthEmailFromAddress(),
    to,
    subject: "Welcome to School directory",
    html: `<p>Hi ${escapeHtml(name)},</p>
<p>Thanks for creating an account. You can manage students, teachers, and classes from your dashboard.</p>
<p>If you did not sign up, you can ignore this message.</p>`,
  });

  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const };
}

export async function sendSignInActivityEmail(
  to: string,
  displayName: string | undefined,
  ctx: { device: string; location: string; ip: string; whenIso: string }
) {
  const resend = getResend();
  if (!resend) return { ok: false as const, reason: "missing_resend" };

  const name = displayName?.trim() || "there";
  const { error } = await resend.emails.send({
    from: getAuthEmailFromAddress(),
    to,
    subject: "New sign-in to your account",
    html: `<p>Hi ${escapeHtml(name)},</p>
<p>We noticed a sign-in to your School directory account.</p>
<ul>
<li><strong>When:</strong> ${escapeHtml(ctx.whenIso)}</li>
<li><strong>Approximate location:</strong> ${escapeHtml(ctx.location)}</li>
<li><strong>Device / browser:</strong> ${escapeHtml(ctx.device)}</li>
<li><strong>IP address:</strong> ${escapeHtml(ctx.ip)}</li>
</ul>
<p>If this was you, you can ignore this email. If not, change your password and review your account security.</p>`,
  });

  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const };
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
