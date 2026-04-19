import { createClient, type User } from "@supabase/supabase-js";

export type AuthFromRequestResult =
  | { ok: true; user: User; accessToken: string }
  | { ok: false; status: number; message: string };

export async function getUserFromAuthorizationHeader(request: Request): Promise<AuthFromRequestResult> {
  const auth = request.headers.get("authorization");
  const accessToken = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!accessToken) {
    return { ok: false, status: 401, message: "Missing or invalid authorization" };
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return { ok: false, status: 401, message: error?.message ?? "Invalid session" };
  }

  return { ok: true, user, accessToken };
}

export function createUserScopedSupabase(accessToken: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
